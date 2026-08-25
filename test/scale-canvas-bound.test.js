// Task 1.5 property test (authored as SOURCE ONLY — not executed on this machine;
// per the finance-sankey-web steering, Node/vitest cannot run here, so this is a
// committed executable specification).
//
// Feature: finance-sankey-interactive-drilldown, Property 4: The reference income
// never exceeds the canvas height — for any Comparison_Mode and any window
// belonging to that mode, the window's income multiplied by curScale is <= TARGET_H
// (the reference income maps to exactly TARGET_H), because the reference is the
// maximum income of that mode; consequently no node representing an in-mode
// window's income is sized beyond the canvas reference height.
// Validates: Requirements 2.7
import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';
import { readIndexHtml, loadAppExports } from './load-app.js';

// build() sets curScale = TARGET_H / scaleReferenceFor(mode, monthly, refs).
// TARGET_H is not exported, so read the literal from index.html source to keep
// this test in sync with the layout config it verifies.
function readTargetH() {
  const html = readIndexHtml();
  const m = html.match(/TARGET_H\s*=\s*(\d+(?:\.\d+)?)/);
  if (!m) throw new Error('TARGET_H not found in index.html');
  return Number(m[1]);
}

const MODES = ['trailing', 'month', 'year', 'all'];
const MODE_KEY = {
  trailing: 'trailing12',
  month: 'singleMonth',
  year: 'fullYear',
  all: 'allTime',
};

// A refs object shaped like META.refs: each mode carries the MAXIMUM income of
// that mode (income >= 1 floor) and a positive reference-window month count.
const refsArb = fc.record({
  trailing12: fc.record({
    income: fc.double({ min: 1, max: 1e9, noNaN: true }),
    months: fc.integer({ min: 1, max: 12 }),
  }),
  singleMonth: fc.record({
    income: fc.double({ min: 1, max: 1e9, noNaN: true }),
    months: fc.constant(1),
  }),
  fullYear: fc.record({
    income: fc.double({ min: 1, max: 1e9, noNaN: true }),
    months: fc.constant(12),
  }),
  allTime: fc.record({
    income: fc.double({ min: 1, max: 1e9, noNaN: true }),
    months: fc.integer({ min: 1, max: 240 }),
  }),
});

describe('Property 4: the reference income never exceeds the canvas height', () => {
  let scaleReferenceFor;
  let TARGET_H;

  beforeAll(async () => {
    ({ scaleReferenceFor } = await loadAppExports());
    TARGET_H = readTargetH();
  });

  it('any in-mode window income maps to <= TARGET_H (undivided reference)', () => {
    fc.assert(
      fc.property(
        refsArb,
        fc.constantFrom(...MODES),
        // frac in [0,1] guarantees windowIncome <= the mode reference (the max)
        fc.double({ min: 0, max: 1, noNaN: true }),
        (refs, mode, frac) => {
          const ref = refs[MODE_KEY[mode]];
          const windowIncome = frac * ref.income; // any window of this mode is <= the reference
          const curScale = TARGET_H / scaleReferenceFor(mode, false, refs);
          // the reference income itself maps to exactly TARGET_H
          expect(windowIncome * curScale).toBeLessThanOrEqual(TARGET_H + 1e-6);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('the reference income maps to exactly TARGET_H (undivided)', () => {
    fc.assert(
      fc.property(refsArb, fc.constantFrom(...MODES), (refs, mode) => {
        const ref = refs[MODE_KEY[mode]];
        const curScale = TARGET_H / scaleReferenceFor(mode, false, refs);
        expect(ref.income * curScale).toBeCloseTo(TARGET_H, 6);
      }),
      { numRuns: 200 }
    );
  });

  it('per-month (avg): any in-mode per-month window income maps to <= TARGET_H', () => {
    fc.assert(
      fc.property(
        refsArb,
        fc.constantFrom(...MODES),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (refs, mode, frac) => {
          const ref = refs[MODE_KEY[mode]];
          // per-month reference = base income / mode-window months (the max per-month income)
          const perMonthRef = ref.income / ref.months;
          const windowMonthlyIncome = frac * perMonthRef; // any in-mode per-month window <= reference
          const curScale = TARGET_H / scaleReferenceFor(mode, true, refs);
          expect(windowMonthlyIncome * curScale).toBeLessThanOrEqual(TARGET_H + 1e-6);
        }
      ),
      { numRuns: 200 }
    );
  });
});
