// Property tests for the Scale_Engine (task 1.3 of the
// finance-sankey-interactive-drilldown spec).
//
// Covers design Correctness Properties 1, 2 and 3:
//   P1 - Scale references match their model definitions
//   P2 - The active Scale_Reference depends only on (mode, toggle, refs)
//        and is window-independent
//   P3 - Per-month-average scales the reference by the mode's window length,
//        toggle off restores the base
//
// These target the pure helpers exposed through the Node/fast-check export
// shim in index.html (same loader as harness.test.js: loadAppExports()).
//
// NOTE on how P1 reaches the derivation. `aggregate()` writes its four
// per-Comparison_Mode references into the module-scope `META.refs`, but the
// shim (see load-app.js -> module.exports) exposes only the functions, not
// `META`, so `META.refs` cannot be read back from outside. Per the task's
// sanctioned fallback, P1 therefore (a) builds a brute-force reference model
// from a synthesized monthly-income map, (b) cross-checks that model against a
// second independent computation, (c) confirms the REAL exported
// `scaleReferenceFor` surfaces each mode's brute-force reference, and (d) runs
// the REAL exported `aggregate()` over the equivalent synthesized CSV rows so
// the shipped derivation path is exercised (must not throw) on >=12-month,
// <12-month and all-zero income maps. If `META.refs` is ever exported, the
// brute-force model in `refsFromMap` can be asserted directly against it.
//
// Per finance-sankey-web.md steering, this suite is authored/committed as
// source but NOT executed on this machine (Node lives only in WSL; W: is not
// mounted there). It is a runnable executable specification for any environment
// with Node + the working tree.

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';
import { loadAppExports } from './load-app.js';

const RUNS = 200; // >= the required minimum of 100 iterations per property

// Comparison_Mode -> reference key (mirrors scaleReferenceFor's MODE_KEY).
const MODE_KEY = { trailing: 'trailing12', month: 'singleMonth', year: 'fullYear', all: 'allTime' };
const MODES = ['trailing', 'month', 'year', 'all'];
const floorPos = v => Math.max(1, v);

let app;
beforeAll(async () => { app = await loadAppExports(); });

// ---------------------------------------------------------------------------
// Brute-force reference MODEL (the "expected" per Property 1's definitions).
// incByMi: { [monthIndex]: income } where monthIndex = year*12 + (month-1).
//   singleMonth = largest single-month income
//   trailing12  = max total over any COMPLETE 12-consecutive-month window,
//                 or the sum over all present months when span < 12 months
//   fullYear    = max calendar-year total (year = floor(mi/12))
//   allTime     = total income over the full history
// every reference income floored to a positive value (>= 1).
// ---------------------------------------------------------------------------
function refsFromMap(m) {
  const keys = Object.keys(m).map(Number);
  const n = keys.length;
  let singleMonth = 0, allTime = 0;
  for (const k of keys) { singleMonth = Math.max(singleMonth, m[k]); allTime += m[k]; }

  let trailing12 = 0, monthsTrailing12 = 12;
  if (n) {
    const lo = Math.min(...keys), hi = Math.max(...keys), span = hi - lo + 1;
    if (span >= 12) {
      for (let end = lo + 11; end <= hi; end++) {
        let s = 0; for (let mo = end - 11; mo <= end; mo++) s += m[mo] || 0;
        trailing12 = Math.max(trailing12, s);
      }
      monthsTrailing12 = 12;
    } else {
      trailing12 = allTime; monthsTrailing12 = span;
    }
  }

  let fullYear = 0;
  { const byYear = {};
    for (const k of keys) { const y = Math.floor(k / 12); byYear[y] = (byYear[y] || 0) + m[k]; }
    for (const y in byYear) fullYear = Math.max(fullYear, byYear[y]); }

  return {
    trailing12:  { income: floorPos(trailing12),  months: monthsTrailing12 },
    singleMonth: { income: floorPos(singleMonth), months: 1 },
    fullYear:    { income: floorPos(fullYear),    months: 12 },
    allTime:     { income: floorPos(allTime),     months: n || 1 },
  };
}

// Synthesize CSV-style rows (array of arrays, the shape aggregate() consumes)
// carrying exactly the income of the given month map, one INCOME row per month.
function csvRowsFromMap(m) {
  const rows = [['YEAR', 'MONTH', 'VALUE', 'TYPE', 'DETAIL', 'CATEGORY1']];
  for (const k of Object.keys(m)) {
    const mi = Number(k), year = Math.floor(mi / 12), month = (mi % 12) + 1;
    rows.push([year, month, m[k], 'INCOME', 'SALARY', 'WORKINCOME']);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Generators for monthly-income maps, covering the three required categories:
// >=12-month span, <12-month span, and all-zero income.
// ---------------------------------------------------------------------------
const mkMap = (startMi, entries) => {
  const m = {};
  for (const { off, val } of entries) { const mi = startMi + off; m[mi] = (m[mi] || 0) + val; }
  return m;
};
const arbStartMi = fc.integer({ min: 2000, max: 2025 })
  .chain(y => fc.integer({ min: 1, max: 12 }).map(mo => y * 12 + (mo - 1)));
const arbVal = fc.integer({ min: 0, max: 20000 });

// broad shape (any span, zeros allowed, may be empty)
const arbGeneral = fc.tuple(
  arbStartMi,
  fc.array(fc.record({ off: fc.nat({ max: 40 }), val: arbVal }), { maxLength: 40 })
).map(([s, e]) => mkMap(s, e));

// all-zero income across a 15-month span
const arbAllZero = arbStartMi.map(s =>
  mkMap(s, Array.from({ length: 15 }, (_, i) => ({ off: i, val: 0 }))));

// strictly < 12 month span (offsets confined to 0..10)
const arbShort = fc.tuple(
  arbStartMi,
  fc.array(fc.record({ off: fc.integer({ min: 0, max: 10 }), val: arbVal }), { minLength: 1, maxLength: 11 })
).map(([s, e]) => mkMap(s, e));

// guaranteed >= 12 month span (an offset 0 and a far offset >= 11)
const arbLong = fc.tuple(
  arbStartMi,
  fc.integer({ min: 11, max: 40 }),
  fc.array(fc.record({ off: fc.integer({ min: 0, max: 40 }), val: arbVal }), { maxLength: 40 })
).map(([s, far, e]) => mkMap(s, [{ off: 0, val: 1000 }, { off: far, val: 1000 }, ...e]));

const arbIncomeMap = fc.oneof(arbGeneral, arbAllZero, arbShort, arbLong);

// Generators for arbitrary references objects (for P2/P3, independent of maps),
// plus realistic map-derived refs.
const arbRef = fc.record({
  income: fc.double({ min: 0, max: 5_000_000, noNaN: true, noDefaultInfinity: true }),
  months: fc.integer({ min: 1, max: 36 }),
});
const arbRefsSynthetic = fc.record({
  trailing12: arbRef, singleMonth: arbRef, fullYear: arbRef, allTime: arbRef,
});
const arbRefs = fc.oneof(arbRefsSynthetic, arbIncomeMap.map(refsFromMap));
const arbMode = fc.constantFrom(...MODES);

describe('Scale_Engine property tests (finance-sankey-interactive-drilldown)', () => {
  it('P1: scale references match their brute-force model definitions', () => {
    // Feature: finance-sankey-interactive-drilldown, Property 1: Scale references match their model definitions
    fc.assert(fc.property(arbIncomeMap, (m) => {
      const refs = refsFromMap(m);
      const keys = Object.keys(m).map(Number);
      const n = keys.length;

      // (b) independent second computation of each quantity
      const sm2 = n ? Math.max(...keys.map(k => m[k])) : 0;
      const all2 = keys.reduce((a, k) => a + m[k], 0);
      const yr = new Map();
      for (const k of keys) { const y = Math.floor(k / 12); yr.set(y, (yr.get(y) || 0) + m[k]); }
      const fy2 = yr.size ? Math.max(...yr.values()) : 0;
      let t12_2 = 0, monthsT2 = 12;
      if (n) {
        const lo = Math.min(...keys), hi = Math.max(...keys), span = hi - lo + 1;
        if (span >= 12) {
          const sums = Array.from({ length: hi - (lo + 11) + 1 }, (_, i) => {
            const end = lo + 11 + i; let s = 0;
            for (let mo = end - 11; mo <= end; mo++) s += m[mo] || 0;
            return s;
          });
          t12_2 = Math.max(...sums); monthsT2 = 12;
        } else { t12_2 = all2; monthsT2 = span; }
      }

      const okIncome =
        refs.singleMonth.income === floorPos(sm2) &&
        refs.allTime.income     === floorPos(all2) &&
        refs.fullYear.income    === floorPos(fy2) &&
        refs.trailing12.income  === floorPos(t12_2);

      // reference-window month counts
      const okMonths =
        refs.singleMonth.months === 1 &&
        refs.fullYear.months    === 12 &&
        refs.allTime.months     === (n || 1) &&
        refs.trailing12.months  === monthsT2;

      // (a) every reference floored to a positive value (>= 1)
      const okFloor = [refs.trailing12, refs.singleMonth, refs.fullYear, refs.allTime]
        .every(r => r.income >= 1);

      // (c) the REAL exported scaleReferenceFor surfaces each brute-force
      //     reference (undivided base, monthly toggle off)
      const okSelect =
        app.scaleReferenceFor('month',    false, refs) === refs.singleMonth.income &&
        app.scaleReferenceFor('trailing', false, refs) === refs.trailing12.income &&
        app.scaleReferenceFor('year',     false, refs) === refs.fullYear.income &&
        app.scaleReferenceFor('all',      false, refs) === refs.allTime.income;

      // (d) the REAL exported derivation path runs without throwing on this shape
      let ran = true;
      try { app.aggregate(csvRowsFromMap(m)); } catch { ran = false; }

      return okIncome && okMonths && okFloor && okSelect && ran;
    }), { numRuns: RUNS });
  });

  it('P2: the active Scale_Reference depends only on (mode, toggle, refs) and is window-independent', () => {
    // Feature: finance-sankey-interactive-drilldown, Property 2: The active Scale_Reference depends only on mode, toggle and references (window-independent)
    fc.assert(fc.property(
      arbRefs, arbMode, fc.boolean(), fc.integer(), fc.integer(), fc.integer(), fc.integer(),
      (refs, mode, monthly, miF1, miT1, miF2, miT2) => {
        const base = refs[MODE_KEY[mode]];
        const expected = floorPos(monthly ? base.income / base.months : base.income);
        const r = app.scaleReferenceFor(mode, monthly, refs);
        // it returns the mode's reference (per the toggle)
        if (r !== expected) return false;
        // window-independent: passing any window params (which the signature
        // does not accept) never changes the result, and any two windows agree.
        const rW1 = app.scaleReferenceFor(mode, monthly, refs, miF1, miT1);
        const rW2 = app.scaleReferenceFor(mode, monthly, refs, miF2, miT2);
        // deterministic / pure: repeated calls are identical
        const rAgain = app.scaleReferenceFor(mode, monthly, refs);
        return rW1 === r && rW2 === r && rAgain === r;
      }
    ), { numRuns: RUNS });
  });

  it('P3: per-month-average scales the reference by the mode window length; toggle off restores base', () => {
    // Feature: finance-sankey-interactive-drilldown, Property 3: Per-month-average scales the reference by the mode's window length
    fc.assert(fc.property(arbRefs, arbMode, (refs, mode) => {
      const base = refs[MODE_KEY[mode]];
      const off = app.scaleReferenceFor(mode, false, refs);
      const on  = app.scaleReferenceFor(mode, true,  refs);
      const expectedOff = floorPos(base.income);                 // undivided base
      const expectedOn  = floorPos(base.income / base.months);   // base / window months
      return off === expectedOff && on === expectedOn;
    }), { numRuns: RUNS });
  });
});
