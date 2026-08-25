// Property tests for the Savings_Calculator (task 4.2 of the
// finance-sankey-interactive-drilldown spec).
//
// Covers design Correctness Property 8:
//   P8 - Savings percentage formula with a zero-income guard.
//        When selectedIncome > 0, savingsPercentage returns
//        (selInc - selExp)/selInc*100 rounded to one decimal (negative results
//        preserved as negative, result always a finite number). When
//        selectedIncome <= 0 (including 0 and negatives) it returns the
//        non-numeric placeholder sentinel `null`, never dividing.
//
// This targets the pure helper `savingsPercentage` exposed through the
// Node/fast-check export shim in index.html (same loader as the other suites:
// loadAppExports()). It mirrors the shipped rounding exactly:
//   Math.round((selInc - selExp)/selInc*1000)/10
// which is round-to-one-decimal of the percentage.
//
// Per finance-sankey-web.md steering, this suite is authored/committed as
// source but NOT executed on this machine (Node lives only in WSL; W: is not
// mounted there). It is a runnable executable specification for any environment
// with Node + the working tree.

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';
import { loadAppExports } from './load-app.js';

const RUNS = 200; // >= the required minimum of 100 iterations per property

// round-to-one-decimal of the savings percentage, matching the implementation:
//   Math.round((selInc - selExp)/selInc*1000)/10
const round1 = (selInc, selExp) =>
  Math.round(((selInc - selExp) / selInc) * 1000) / 10;

let app;
beforeAll(async () => {
  app = await loadAppExports();
});

describe('Savings_Calculator property tests (finance-sankey-interactive-drilldown)', () => {
  it('P8: savings percentage formula holds for selectedIncome > 0, with a null guard for selectedIncome <= 0', () => {
    // Feature: finance-sankey-interactive-drilldown, Property 8: Savings percentage formula with a zero-income guard

    // Positive selected income (strictly > 0). Expenses can be BELOW or ABOVE
    // income, so the savings % ranges over positive AND negative values.
    const arbPositiveIncome = fc.double({
      min: 1e-6,
      max: 5_000_000,
      noNaN: true,
      noDefaultInfinity: true,
    });
    // Expenses: any non-negative amount (can exceed income -> negative savings %),
    // spanning both selExp < selInc and selExp > selInc.
    const arbExpenses = fc.double({
      min: 0,
      max: 10_000_000,
      noNaN: true,
      noDefaultInfinity: true,
    });

    fc.assert(
      fc.property(arbPositiveIncome, arbExpenses, (selInc, selExp) => {
        const r = app.savingsPercentage(selInc, selExp);

        // With selectedIncome > 0 the helper returns a real number ...
        if (typeof r !== 'number') return false;
        // ... never NaN or Infinity ...
        if (!Number.isFinite(r)) return false;
        // ... equal to round1((selInc - selExp)/selInc*100).
        if (r !== round1(selInc, selExp)) return false;

        // Sign is preserved: expenses above income -> strictly negative savings %,
        // expenses below income -> non-negative savings %.
        if (selExp > selInc && !(r < 0)) return false;
        if (selExp < selInc && !(r >= 0)) return false;

        return true;
      }),
      { numRuns: RUNS },
    );
  });

  it('P8 (guard): selectedIncome <= 0 returns the non-numeric placeholder sentinel (null), never dividing', () => {
    // Feature: finance-sankey-interactive-drilldown, Property 8: Savings percentage formula with a zero-income guard

    // Zero and negative income (including "all income deselected" == 0), with
    // arbitrary expenses. The guard must fire and return null without dividing,
    // so the result is never a number, NaN or Infinity.
    const arbNonPositiveIncome = fc.oneof(
      fc.constant(0),
      fc.constant(-0),
      fc.double({ min: -5_000_000, max: -1e-6, noNaN: true, noDefaultInfinity: true }),
    );
    const arbAnyExpenses = fc.double({
      min: -10_000_000,
      max: 10_000_000,
      noNaN: true,
      noDefaultInfinity: true,
    });

    fc.assert(
      fc.property(arbNonPositiveIncome, arbAnyExpenses, (selInc, selExp) => {
        const r = app.savingsPercentage(selInc, selExp);
        // The placeholder sentinel is null (caller renders "—").
        return r === null;
      }),
      { numRuns: RUNS },
    );

    // Explicit boundary: selectedIncome === 0 must return null (no divide-by-zero).
    expect(app.savingsPercentage(0, 0)).toBe(null);
    expect(app.savingsPercentage(0, 1234.56)).toBe(null);
  });
});
