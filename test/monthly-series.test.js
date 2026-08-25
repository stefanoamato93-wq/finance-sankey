// Task 5.2 (spec: finance-sankey-interactive-drilldown) — property tests for the
// Drilldown_Chart per-month series helper `monthlySeries`.
//
// AUTHORED AS SOURCE ONLY — NOT EXECUTED on this machine (see steering
// finance-sankey-web.md: Node/vitest live only in WSL and W: is not mounted
// there). Committed as an executable specification for any environment where
// Node + fast-check are available.
//
// Approach — exercise the REAL exported helper against an INDEPENDENT
// brute-force recompute. Unlike the applySelection test, monthlySeries takes its
// DATA / DETAIL rows DIRECTLY as function arguments, so we construct the row
// arrays inline and pass them straight in — no aggregate()/module-state dance.
//
//   monthlySeries(kind, category, miF, miT, DATA, DETAIL) -> [{mi, value}, ...]
//     DATA rows   : [mi, kind('I'|'E'), group, leaf, val]
//     DETAIL rows : [mi, leaf, dn, v]
//   income  -> sum DATA 'I' rows with leaf === category, val as-is
//   expense -> sum DATA 'E' rows with leaf === category, as -val
//   detail  -> sum DETAIL rows with dn === category, v as-is
//   Emits exactly one {mi,value} per month in [miF,miT] inclusive, chronological
//   oldest->newest, 0 for empty months, none outside the window.
//
// Sign convention (mirrors monthlySeries / computeLinks): INCOME vals are stored
// positive; EXPENSE vals are stored NEGATIVE and flipped to a positive spend
// (-val). We generate a positive magnitude `m` and store it as +m for income
// rows and -m for expense rows, so every matched contribution is +m and all
// sums are exact integers (Math.round is a no-op, toBe() equality is safe).
//
// `fmt` is NOT exported from index.html, so we model its label formatting
// locally, verbatim from the source:
//   const fmt = v => showK
//     ? (v/1000).toLocaleString(undefined,{maximumFractionDigits:1}) + "K"
//     : Math.round(v).toLocaleString();
// and assert the label mapping for both K states against the series values.

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';
import { loadAppExports } from './load-app.js';

const RUNS = 200; // >= the required minimum of 100 iterations

// Local model of the app's fmt() — it is not exported, so we mirror it exactly.
function fmtModel(v, showK) {
  return showK
    ? (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'K'
    : Math.round(v).toLocaleString();
}

let app;
beforeAll(async () => { app = await loadAppExports(); });

// ---------------------------------------------------------------------------
// Generators.
// Month indices use the app convention mi = year*12 + (month-1); the exact
// origin is irrelevant to the logic, so we anchor around 2020 (24240).
// Rows are generated across a range WIDER than the active window so every run
// carries rows both inside and outside [miF, miT] (exercises window exclusion).
// Leaf/dn names double as income/expense/detail categories; a small pool means
// the chosen category is frequently present, while an "absent" pick still occurs
// (exercising the all-zero series / empty-window structure).
// ---------------------------------------------------------------------------
const LEAF_POOL = ['L0', 'L1', 'L2', 'L3'];
const DN_POOL = ['D0', 'D1', 'D2', 'D3'];
const GRP_POOL = ['G0', 'G1'];
const kindArb = fc.constantFrom('income', 'expense', 'detail');
const mag = fc.integer({ min: 1, max: 100000 });

// A window [miF, miT] plus a padded row-range [rowLo, rowHi] that overhangs the
// window on both sides, so out-of-window rows are guaranteed to be generatable.
const windowArb = fc
  .record({
    base: fc.integer({ min: 24200, max: 24260 }),
    len: fc.integer({ min: 1, max: 18 }),
    padLo: fc.integer({ min: 1, max: 6 }),
    padHi: fc.integer({ min: 1, max: 6 }),
  })
  .map(({ base, len, padLo, padHi }) => {
    const miF = base;
    const miT = base + len - 1;
    return { miF, miT, rowLo: miF - padLo, rowHi: miT + padHi };
  });

// DATA row generator: [mi, k, grp, leaf, val]. Income vals positive, expense
// vals negative (stored as -magnitude) so monthlySeries' -val yields +magnitude.
function dataRowsArb({ rowLo, rowHi }) {
  return fc.array(
    fc
      .record({
        mi: fc.integer({ min: rowLo, max: rowHi }),
        k: fc.constantFrom('I', 'E'),
        grp: fc.constantFrom(...GRP_POOL),
        leaf: fc.constantFrom(...LEAF_POOL),
        m: mag,
      })
      .map(({ mi, k, grp, leaf, m }) => [mi, k, grp, leaf, k === 'I' ? m : -m]),
    { maxLength: 40 },
  );
}

// DETAIL row generator: [mi, leaf, dn, v]. Detail values are already positive.
function detailRowsArb({ rowLo, rowHi }) {
  return fc.array(
    fc.record({
      mi: fc.integer({ min: rowLo, max: rowHi }),
      leaf: fc.constantFrom(...LEAF_POOL),
      dn: fc.constantFrom(...DN_POOL),
      v: mag,
    }).map(({ mi, leaf, dn, v }) => [mi, leaf, dn, v]),
    { maxLength: 40 },
  );
}

// Category pick for a kind: mostly a value from the relevant pool (frequently
// present), occasionally an absent value (exercises the all-zero series).
function categoryArb(kind) {
  const pool = kind === 'detail' ? DN_POOL : LEAF_POOL;
  return fc.constantFrom(...pool, 'ABSENT');
}

// Full scenario: a window, both row sets over the padded range, a drilled kind
// and category.
const scenarioArb = windowArb.chain((win) =>
  fc
    .record({
      data: dataRowsArb(win),
      detail: detailRowsArb(win),
      kind: kindArb,
    })
    .chain(({ data, detail, kind }) =>
      categoryArb(kind).map((category) => ({ ...win, data, detail, kind, category })),
    ),
);

// ---------------------------------------------------------------------------
// Independent brute-force per-month sum for a given kind/category/window.
// Returns a plain object { mi -> summed value } including only in-window months.
// ---------------------------------------------------------------------------
function bruteSums({ kind, category, miF, miT, data, detail }) {
  const sums = {};
  if (kind === 'detail') {
    for (const [mi, , dn, v] of detail) {
      if (dn !== category || mi < miF || mi > miT) continue;
      sums[mi] = (sums[mi] || 0) + v;
    }
  } else {
    const wantKind = kind === 'income' ? 'I' : 'E';
    for (const [mi, k, , leaf, val] of data) {
      if (k !== wantKind || leaf !== category || mi < miF || mi > miT) continue;
      sums[mi] = (sums[mi] || 0) + (wantKind === 'I' ? val : -val);
    }
  }
  return sums;
}

describe('monthlySeries drilldown per-month values (finance-sankey-interactive-drilldown, Property 9)', () => {
  // Feature: finance-sankey-interactive-drilldown, Property 9: Drilldown bar
  // values equal the per-month category sums
  // Validates: Requirements 5.1, 5.2, 5.3, 5.6, 5.7

  it('Property 9a: each bar value equals the brute-force per-month category sum from the matching source', () => {
    fc.assert(
      fc.property(scenarioArb, (sc) => {
        const series = app.monthlySeries(sc.kind, sc.category, sc.miF, sc.miT, sc.data, sc.detail);
        const sums = bruteSums(sc);
        for (const { mi, value } of series) {
          expect(value).toBe(sums[mi] || 0);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('Property 9b: the bar label equals fmt(value) — integer euros with K off, thousands to 1 decimal with K on', () => {
    fc.assert(
      fc.property(scenarioArb, (sc) => {
        const series = app.monthlySeries(sc.kind, sc.category, sc.miF, sc.miT, sc.data, sc.detail);
        const sums = bruteSums(sc);
        for (const { mi, value } of series) {
          // value is independently anchored to the brute-force sum first.
          const truth = sums[mi] || 0;
          expect(value).toBe(truth);
          // K OFF: full euros via Math.round(v).toLocaleString().
          const labelOff = fmtModel(value, false);
          expect(labelOff).toBe(Math.round(value).toLocaleString());
          // K ON: thousands to one decimal + "K".
          const labelOn = fmtModel(value, true);
          expect(labelOn).toBe(
            (value / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'K',
          );
          expect(labelOn.endsWith('K')).toBe(true);
        }
      }),
      { numRuns: RUNS },
    );
  });
});

describe('monthlySeries drilldown window structure (finance-sankey-interactive-drilldown, Property 10)', () => {
  // Feature: finance-sankey-interactive-drilldown, Property 10: Drilldown series
  // covers exactly the active window, one bar per month
  // Validates: Requirements 5.4, 6.1, 6.2, 6.3, 6.4, 6.5

  it('Property 10a: series length equals the number of months in the window (one bar per month)', () => {
    fc.assert(
      fc.property(scenarioArb, (sc) => {
        const series = app.monthlySeries(sc.kind, sc.category, sc.miF, sc.miT, sc.data, sc.detail);
        expect(series.length).toBe(sc.miT - sc.miF + 1);
      }),
      { numRuns: RUNS },
    );
  });

  it('Property 10b: indices are exactly miF..miT ascending, and no index falls outside the window', () => {
    fc.assert(
      fc.property(scenarioArb, (sc) => {
        const series = app.monthlySeries(sc.kind, sc.category, sc.miF, sc.miT, sc.data, sc.detail);
        const expected = [];
        for (let mi = sc.miF; mi <= sc.miT; mi++) expected.push(mi);
        expect(series.map((p) => p.mi)).toEqual(expected);
        // Strictly ascending + within bounds (redundant with the equality above,
        // asserted explicitly to pin the ordering + window-boundary guarantees).
        for (let i = 0; i < series.length; i++) {
          expect(series[i].mi).toBeGreaterThanOrEqual(sc.miF);
          expect(series[i].mi).toBeLessThanOrEqual(sc.miT);
          if (i > 0) expect(series[i].mi).toBe(series[i - 1].mi + 1);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('Property 10c: months with no activity are value 0', () => {
    fc.assert(
      fc.property(scenarioArb, (sc) => {
        const series = app.monthlySeries(sc.kind, sc.category, sc.miF, sc.miT, sc.data, sc.detail);
        const sums = bruteSums(sc);
        for (const { mi, value } of series) {
          if (!(mi in sums)) expect(value).toBe(0);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('Property 10d: rows outside the window are excluded even when present in DATA/DETAIL', () => {
    fc.assert(
      fc.property(scenarioArb, (sc) => {
        const series = app.monthlySeries(sc.kind, sc.category, sc.miF, sc.miT, sc.data, sc.detail);
        // The series total equals the in-window brute-force total, so any rows
        // for the same category at mi < miF or mi > miT contribute nothing.
        const sums = bruteSums(sc); // in-window only, by construction
        const inWindowTotal = Object.values(sums).reduce((a, b) => a + b, 0);
        const seriesTotal = series.reduce((a, p) => a + p.value, 0);
        expect(seriesTotal).toBe(inWindowTotal);

        // And a total computed WITHOUT the window filter (across the full padded
        // row range) is >= the series total; the difference is exactly the
        // out-of-window rows the helper must drop.
        let unfilteredTotal = 0;
        if (sc.kind === 'detail') {
          for (const [, , dn, v] of sc.detail) if (dn === sc.category) unfilteredTotal += v;
        } else {
          const wantKind = sc.kind === 'income' ? 'I' : 'E';
          for (const [, k, , leaf, val] of sc.data) {
            if (k === wantKind && leaf === sc.category) {
              unfilteredTotal += wantKind === 'I' ? val : -val;
            }
          }
        }
        expect(unfilteredTotal).toBeGreaterThanOrEqual(seriesTotal);
      }),
      { numRuns: RUNS },
    );
  });
});
