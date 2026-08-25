// Task 2.4 (spec: finance-sankey-interactive-drilldown) — property test for the
// selection-filtering helper `applySelection`.
//
// AUTHORED AS SOURCE ONLY — NOT EXECUTED on this machine (see steering
// finance-sankey-web.md: Node/vitest live only in WSL and W: is not mounted
// there). Committed as an executable specification for any environment where
// Node + fast-check are available.
//
// Approach — exercise the REAL production path end to end:
//   We synthesize CSV-style rows (the array-of-arrays shape aggregate() consumes),
//   run the REAL exported aggregate() to populate the module-scope DATA, then the
//   REAL exported computeLinks(miF,miT) to get a realistic `res` in the exact
//   shape applySelection expects (links: [source,target,value] triples, plus
//   income / expGrp / sav / months). We then run the REAL exported
//   applySelection(res, deselected) and validate its totals against an
//   INDEPENDENT brute-force recompute over the generated leaf structure (the
//   ground truth we fed in), never re-deriving from applySelection's own logic.
//
//   aggregate() assigns the module-scope `DATA` (a closure `let` in index.html)
//   and computeLinks() reads it, so calling app.aggregate(rows) then
//   app.computeLinks(...) back-to-back within one synchronous property run shares
//   state correctly (no async load() can interleave the pair).
//
// Entry-key identities (window-independent, mirror index.html):
//   income leaf         -> "I|"+leaf
//   income group        -> "IG|"+group
//   expense macro group -> "EG|"+group
//   expense leaf        -> "E|"+leaf
//
// Sign convention (mirrors aggregate()/computeLinks()): INCOME rows carry a
// positive VALUE; EXPENSES rows carry a NEGATIVE VALUE which computeLinks flips
// to a positive spend (-val). So a generated expense "value" (positive) is fed
// as -value and surfaces as +value in res. Generated values are integers, so
// all sums are exact and toBe() equality is safe (Math.round is a no-op).

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';
import { loadAppExports } from './load-app.js';

const RUNS = 200; // >= the required minimum of 100 iterations

// Fixed single-month window keeps computeLinks aggregation trivial (one month),
// so the generated leaf totals equal res leaf totals exactly.
const YEAR = 2020, MONTH = 1, MI = YEAR * 12 + (MONTH - 1);

// Group display name -> CATEGORY1 token (reverse of INCGRP / EXPGRP in index.html).
const INC_CAT = { 'Work income': 'WORKINCOME', 'Non-work income': 'NONWORKINCOME' };
const EXP_CAT = { Needs: 'NEEDS', Wants: 'WANTS', Liberality: 'LIBERALITY' };

let app;
beforeAll(async () => { app = await loadAppExports(); });

// ---------------------------------------------------------------------------
// Generators. Leaf names are assigned by index so they are unique and each maps
// to exactly ONE group (avoids computeLinks' last-group-wins merge on collision).
// Names are already upper-case so norm() (which upper-cases DETAIL/LABEL) is a
// no-op and the res keys match the generated names verbatim.
// ---------------------------------------------------------------------------
const incGroupArb = fc.constantFrom('Work income', 'Non-work income');
const expGroupArb = fc.constantFrom('Needs', 'Wants', 'Liberality');
const posVal = fc.integer({ min: 1, max: 100000 });

const incomeLeavesArb = fc
  .array(fc.record({ group: incGroupArb, value: posVal }), { minLength: 1, maxLength: 8 })
  .map(arr => arr.map((r, i) => ({ leaf: 'INC' + i, group: r.group, value: r.value })));

const expenseLeavesArb = fc
  .array(fc.record({ group: expGroupArb, value: posVal }), { minLength: 1, maxLength: 8 })
  .map(arr => arr.map((r, i) => ({ leaf: 'EXP' + i, group: r.group, value: r.value })));

// Build the array-of-arrays rows aggregate() consumes for one month.
function csvRows(incomeLeaves, expenseLeaves) {
  const rows = [['YEAR', 'MONTH', 'VALUE', 'TYPE', 'DETAIL', 'LABEL', 'CATEGORY1']];
  for (const { leaf, group, value } of incomeLeaves) {
    rows.push([YEAR, MONTH, value, 'INCOME', leaf, '', INC_CAT[group]]);
  }
  for (const { leaf, group, value } of expenseLeaves) {
    // expenses stored negative in the sheet; computeLinks flips to +value spend.
    rows.push([YEAR, MONTH, -value, 'EXPENSES', '', leaf, EXP_CAT[group]]);
  }
  return rows;
}

// Drive the REAL production path: aggregate() -> computeLinks() -> res.
function buildRes(incomeLeaves, expenseLeaves) {
  app.aggregate(csvRows(incomeLeaves, expenseLeaves));
  return app.computeLinks(MI, MI);
}

// Independent brute-force recompute over ONLY the selected entries, using the
// generated ground-truth leaf list (not res, not applySelection's internals).
// A leaf is selected iff neither its own key nor its group key is deselected.
function recomputeSelected(incomeLeaves, expenseLeaves, ds) {
  let income = 0, outflow = 0;
  for (const { leaf, group, value } of incomeLeaves) {
    if (ds.has('I|' + leaf) || ds.has('IG|' + group)) continue;
    income += value;
  }
  for (const { leaf, group, value } of expenseLeaves) {
    if (ds.has('E|' + leaf) || ds.has('EG|' + group)) continue;
    outflow += value;
  }
  return { income, outflow, sav: income - outflow };
}

const sumVals = obj => Object.values(obj).reduce((a, b) => a + b, 0);

describe('applySelection selection-filtering (finance-sankey-interactive-drilldown, Property 7)', () => {
  // Feature: finance-sankey-interactive-drilldown, Property 7: Selection filtering
  // equals recomputing over selected entries only
  // Validates: Requirements 3.3, 3.4, 4.3, 4.4

  it('Property 7a: the empty deselected set is the identity (income/outflow/sav equal computeLinks totals)', () => {
    fc.assert(
      fc.property(incomeLeavesArb, expenseLeavesArb, (income, expense) => {
        const res = buildRes(income, expense);
        const resOutflow = sumVals(res.expGrp); // outflow = sum of expGrp values
        const applied = app.applySelection(res, new Set());
        // Identity: totals are unchanged vs the raw computeLinks result.
        expect(applied.income).toBe(res.income);
        expect(sumVals(applied.expGrp)).toBe(resOutflow);
        expect(applied.sav).toBe(res.sav);
        // And they equal the ground-truth full recompute (nothing deselected).
        const full = recomputeSelected(income, expense, new Set());
        expect(applied.income).toBe(full.income);
        expect(sumVals(applied.expGrp)).toBe(full.outflow);
        expect(applied.sav).toBe(full.sav);
      }),
      { numRuns: RUNS },
    );
  });

  it('Property 7b: deselecting one income leaf reduces selected income by exactly that value (sav follows)', () => {
    fc.assert(
      fc.property(
        incomeLeavesArb,
        expenseLeavesArb,
        fc.nat(),
        (income, expense, pick) => {
          const res = buildRes(income, expense);
          const base = app.applySelection(res, new Set());
          const target = income[pick % income.length];
          const ds = new Set(['I|' + target.leaf]);
          const applied = app.applySelection(res, ds);
          // Selected income drops by exactly the leaf's value; expenses untouched.
          expect(applied.income).toBe(base.income - target.value);
          expect(sumVals(applied.expGrp)).toBe(sumVals(base.expGrp));
          // sav = income - outflow, so it drops by the same amount.
          expect(applied.sav).toBe(base.sav - target.value);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('Property 7c: deselecting one expense leaf reduces selected expenses by exactly that value (sav rises by it)', () => {
    fc.assert(
      fc.property(
        incomeLeavesArb,
        expenseLeavesArb,
        fc.nat(),
        (income, expense, pick) => {
          const res = buildRes(income, expense);
          const base = app.applySelection(res, new Set());
          const target = expense[pick % expense.length];
          const ds = new Set(['E|' + target.leaf]);
          const applied = app.applySelection(res, ds);
          // Selected expenses (sum of expGrp) drop by exactly the leaf's value.
          expect(sumVals(applied.expGrp)).toBe(sumVals(base.expGrp) - target.value);
          // Income untouched; sav = income - outflow rises by the removed expense.
          expect(applied.income).toBe(base.income);
          expect(applied.sav).toBe(base.sav + target.value);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('Property 7d: applySelection totals equal a brute-force recompute over selected entries only (random subsets)', () => {
    // Chain the leaf specs to a random subset of the ACTUAL entry keys present
    // (income leaves + income groups + expense leaves + expense groups), so the
    // deselected set exercises leaf-level AND group-level exclusion.
    const scenarioArb = fc
      .record({ income: incomeLeavesArb, expense: expenseLeavesArb })
      .chain(({ income, expense }) => {
        const keys = [
          ...income.map(x => 'I|' + x.leaf),
          ...new Set(income.map(x => 'IG|' + x.group)),
          ...expense.map(x => 'E|' + x.leaf),
          ...new Set(expense.map(x => 'EG|' + x.group)),
        ];
        return fc
          .subarray(keys)
          .map(sel => ({ income, expense, deselected: new Set(sel) }));
      });

    fc.assert(
      fc.property(scenarioArb, ({ income, expense, deselected }) => {
        const res = buildRes(income, expense);
        const applied = app.applySelection(res, deselected);
        const exp = recomputeSelected(income, expense, deselected);
        expect(applied.income).toBe(exp.income);
        expect(sumVals(applied.expGrp)).toBe(exp.outflow);
        expect(applied.sav).toBe(exp.sav);
      }),
      { numRuns: RUNS },
    );
  });
});
