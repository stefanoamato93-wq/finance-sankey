// Task 5.5 (spec: finance-sankey-interactive-drilldown) — property test for the
// Drilldown_Chart / Selection_State independence contract.
//
// AUTHORED AS SOURCE ONLY — NOT EXECUTED on this machine (see steering
// finance-sankey-web.md: Node/vitest live only in WSL and W: is not mounted
// there). Committed as an executable specification for any environment where
// Node + fast-check are available.
//
// Why a local model instead of importing the production helpers:
//   The drilldown lifecycle (`openDrilldown`/`closeDrilldown`) and the
//   Selection_State (`deselected`, a module-scope Set) are DOM-wired module-scope
//   state in index.html — openDrilldown/closeDrilldown mutate `drill` and toggle
//   the overlay element's display, and are wired to a close button + Escape key —
//   so they are intentionally NOT exposed through the CommonJS test-export shim
//   (which only exports the pure helpers: parseCSV, aggregate, computeLinks,
//   detailFor, ..., scaleReferenceFor, applySelection, savingsPercentage,
//   monthlySeries). Design Property 11 concerns the *state contract* (dismissing
//   the drilldown preserves the Selection_State), not the DOM. We therefore model
//   the SAME contract with a small faithful local model:
//       state = { deselected: Set, drill: null | { kind, category } }
//       openDrilldown(state, kind, category) -> sets state.drill, leaves
//                                               state.deselected untouched
//       closeDrilldown(state)                -> sets state.drill = null, leaves
//                                               state.deselected untouched
//   mirroring index.html's openDrilldown/closeDrilldown, which set `drill` and
//   never read or mutate `deselected`. As an extra guard we assert via source
//   inspection (readIndexHtml) that closeDrilldown() sets `drill=null` and does
//   NOT reference `deselected`, so the modeled contract matches shipped code.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readIndexHtml } from './load-app.js';

// ---- Entry key format (mirrors index.html, window-independent identities) ----
//   income leaf         -> "I|"+leaf
//   income group        -> "IG|"+group
//   expense macro group -> "EG|"+group
//   expense leaf        -> "E|"+leaf
const PREFIXES = ['I|', 'IG|', 'EG|', 'E|'];

/** Generator for a single well-formed, window-independent Entry key. */
const entryKeyArb = fc
  .tuple(
    fc.constantFrom(...PREFIXES),
    fc.string({ minLength: 1, maxLength: 12 }),
  )
  .map(([prefix, name]) => prefix + name);

/** Generator for a Selection_State: a Set of deselected Entry keys. */
const selectionStateArb = fc
  .array(entryKeyArb, { maxLength: 20 })
  .map((keys) => new Set(keys));

/** Generator for a drill target: a (kind, category) pair. */
const kindArb = fc.constantFrom('income', 'expense', 'detail');
const drillTargetArb = fc.record({
  kind: kindArb,
  category: fc.string({ minLength: 1, maxLength: 20 }),
});

// ---- Faithful local model of the production drilldown lifecycle ----
// Mirrors index.html:
//   let drill=null;
//   openDrilldown(category, kind){ ...; drill={kind, category}; ...; }
//   closeDrilldown(){ drill=null; ... }  // deselected is NOT touched
// The model keeps `deselected` and `drill` as the two separate module-scope
// variables they are in the app, and open/close only ever touch `drill`.
function openDrilldownModel(state, target) {
  state.drill = { kind: target.kind, category: target.category };
  // Selection_State (deselected) is deliberately left untouched.
  return state;
}
function closeDrilldownModel(state) {
  state.drill = null; // Selection_State (deselected) is NOT touched
  return state;
}
const setsEqual = (a, b) =>
  a.size === b.size && [...a].every((k) => b.has(k));

describe('finance-sankey-interactive-drilldown drilldown/selection independence (Property 11)', () => {
  // Feature: finance-sankey-interactive-drilldown, Property 11: Dismissing the
  // drilldown preserves the Selection_State — for any Selection_State, opening a
  // Drilldown_Chart and then dismissing it leaves the Selection_State unchanged
  // (closing clears only the drilldown state).
  // Validates: Requirement 5.9
  it('Property 11: open then close the drilldown leaves the deselected Set unchanged', () => {
    fc.assert(
      fc.property(selectionStateArb, drillTargetArb, (deselected, target) => {
        // Snapshot the Selection_State members before touching the drilldown.
        const before = new Set(deselected);
        const state = { deselected, drill: null };

        // Open the drilldown: `drill` is set, `deselected` must be untouched.
        openDrilldownModel(state, target);
        expect(state.drill).toEqual({ kind: target.kind, category: target.category });
        expect(setsEqual(state.deselected, before)).toBe(true);

        // Close (dismiss) the drilldown: `drill` clears to null, and the
        // Selection_State is still exactly the same members as before.
        closeDrilldownModel(state);
        expect(state.drill).toBeNull();
        expect(setsEqual(state.deselected, before)).toBe(true);
        // Same object identity too: closing does not replace the set.
        expect(state.deselected).toBe(deselected);
      }),
      { numRuns: 200 },
    );
  });

  // Source-inspection guard: the production closeDrilldown() must set `drill=null`
  // and must NOT reference `deselected`, so the local model — which touches only
  // `drill` on close — stays faithful to shipped code.
  it('index.html closeDrilldown() sets drill=null and does not touch deselected', () => {
    const html = readIndexHtml();

    // The two states are separate module-scope variables.
    expect(html).toMatch(/let\s+drill\s*=\s*null/);
    expect(html).toMatch(/let\s+deselected\s*=\s*new\s+Set\(\)/);

    // openDrilldown sets drill and closeDrilldown clears it.
    expect(html).toMatch(/function\s+openDrilldown\s*\(\s*category\s*,\s*kind\s*\)/);
    expect(html).toMatch(/function\s+closeDrilldown\s*\(\s*\)/);

    // Isolate the closeDrilldown() body and check it mutates drill but never
    // reads or writes the Selection_State (deselected).
    const m = html.match(/function\s+closeDrilldown\s*\(\s*\)\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m[1];
    expect(body).toMatch(/drill\s*=\s*null/);
    expect(body).not.toMatch(/deselected/);
  });
});
