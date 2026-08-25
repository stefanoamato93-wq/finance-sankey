// Task 7.2 (finance-sankey-interactive-drilldown): example / DOM / regression checks.
//
// These are EXAMPLE / source-inspection tests, not property tests. Where full
// DOM rendering via jsdom is impractical for a single self-contained page whose
// inline <script> runs load() at top level, we assert against the index.html
// source (CSS rules, wiring, handler kinds) plus the pure helpers exported
// through the Node test-export shim (loadAppExports). Each test is tagged with
// the requirement it validates.
//
// Per the finance-sankey-web.md steering, this suite is committed as SOURCE but
// is NOT executed on this machine (Node lives only in WSL; W: is not mounted
// there). It is an executable specification for any environment with Node + the
// working tree.
import { describe, it, expect } from 'vitest';
import { readIndexHtml, extractInlineScript, loadAppExports } from './load-app.js';

const html = readIndexHtml();
const script = extractInlineScript(html);

describe('finance-sankey-interactive-drilldown — rendering & regression (Task 7.2)', () => {

  // --- Requirement 3.2: deselected entries are de-emphasized -----------------
  describe('Requirement 3.2 — de-emphasis of deselected entries', () => {
    it('defines .node.deselected CSS with reduced opacity + grayscale', () => {
      // Validates: Requirement 3.2
      expect(html).toMatch(/\.node\.deselected\s*\{[^}]*opacity\s*:\s*\.?\d/);
      expect(html).toMatch(/\.node\.deselected\s*\{[^}]*grayscale\(1\)/);
    });

    it('defines .link.deselected CSS with reduced opacity + grayscale', () => {
      // Validates: Requirement 3.2
      expect(html).toMatch(/\.link\.deselected\s*\{[^}]*fill-opacity\s*:\s*\.?\d/);
      expect(html).toMatch(/\.link\.deselected\s*\{[^}]*grayscale\(1\)/);
    });

    it('render() adds the `deselected` class when the entry key is hidden (in the deselected set)', () => {
      // Validates: Requirement 3.2 — the class is applied for entries whose key
      // is in the hidden set (hidden = in-window deselected keys from applySelection).
      expect(script).toMatch(/hidden\s*=\s*res\.hidden/);
      expect(script).toMatch(/isHidden\s*=\s*key\s*&&\s*hidden\.has\(key\)/);
      expect(script).toMatch(/if\s*\(\s*isHidden\s*\)\s*g\.classList\.add\(\s*['"]deselected['"]\s*\)/);
    });
  });

  // --- Requirement 4.6: totals reflect the current selection -----------------
  describe('Requirement 4.6 — totals cards reflect the selection', () => {
    it('paintTotals reads the post-applySelection result (income/expGrp/sav from res)', () => {
      // Validates: Requirement 4.6 — cards are painted off the selection-adjusted res.
      expect(script).toMatch(/function\s+paintTotals\s*\(\s*res\s*\)/);
      expect(script).toMatch(/const\s*\{\s*income\s*,\s*expGrp\s*,\s*sav\s*\}\s*=\s*res/);
    });

    it('savings figure goes through savingsPercentage with a non-numeric placeholder when null', () => {
      // Validates: Requirement 4.6 (+ 4.5 guard) — savingsPercentage(income,totExp)
      // and the "—" placeholder path when it returns null.
      expect(script).toMatch(/savingsPercentage\s*\(\s*income\s*,\s*totExp\s*\)/);
      // savPct === null -> em-dash placeholder (\u2014).
      expect(script).toMatch(/savPct\s*===\s*null\s*\?\s*['"]\\u2014['"]/);
    });

    it('applySelection totals match a synthesized selection model (identity + exercised)', async () => {
      // Validates: Requirement 4.6 / 4.3 — exercise the pure helper the cards read
      // from, so the numbers the totals cards show equal the selection recompute.
      // NOTE: authored-only; jsdom-backed loadAppExports is not run on this machine.
      const { applySelection } = await loadAppExports();
      const res = {
        links: [
          ['Salary', 'Work', 1000],          // income leaf -> income group
          ['Bonus', 'Work', 200],            // income leaf -> income group
          ['Work', 'Total income', 1200],    // income group subtotal
          ['Total income', 'Expenses', 700],
          ['Expenses', 'Needs', 700],        // expense group subtotal
          ['Needs', 'Rent', 500],            // expense leaf
          ['Needs', 'Food', 200],            // expense leaf
          ['Total income', 'Savings', 500],
        ],
        income: 1200, expGrp: { Needs: 700 }, sav: 500, months: 1,
      };
      // empty selection == identity: cards would show the same numbers as input.
      const same = applySelection(res, new Set());
      expect(same.income).toBe(1200);
      expect(same.expGrp.Needs).toBe(700);
      expect(same.sav).toBe(500);
      // deselecting one income leaf reduces income by exactly that leaf's value;
      // the totals cards must follow (Bonus removed => income 1000, sav 300).
      const drop = applySelection(res, new Set(['I|Bonus']));
      expect(drop.income).toBe(1000);
      expect(drop.expGrp.Needs).toBe(700);
      expect(drop.sav).toBe(300);
    });
  });

  // --- Requirement 5.5: drilldown title = drilled category -------------------
  describe('Requirement 5.5 — drilldown title shows the drilled category', () => {
    it('the overlay has a title element and renderDrilldown sets it to drill.category', () => {
      // Validates: Requirement 5.5
      expect(html).toMatch(/id=["']drillTitle["']/);
      expect(script).toMatch(/const\s*\{\s*kind\s*,\s*category\s*\}\s*=\s*drill/);
      expect(script).toMatch(/drillTitle\.textContent\s*=\s*category/);
    });
  });

  // --- Requirement 5.8: empty-state branch -----------------------------------
  describe('Requirement 5.8 — drilldown empty-state', () => {
    it('renderDrilldown has an explicit empty/all-zero branch that shows a message and hides the chart', () => {
      // Validates: Requirement 5.8 — when the series is empty or every value is 0.
      expect(script).toMatch(/if\s*\(\s*!series\.length\s*\|\|\s*max\s*<=\s*0\s*\)/);
      expect(script).toMatch(/drillMsg\.style\.display\s*=\s*['"]['"]/);   // message shown
      expect(html).toMatch(/id=["']drillMsg["']/);
    });
  });

  // --- Requirement 7.2: regression — net worth path unchanged ----------------
  describe('Requirement 7.2 — regression: net worth / empty-selection identity', () => {
    it('applySelection(res, empty) is the identity for totals (Sankey/cards path value-identical)', async () => {
      // Validates: Requirement 7.2 — with an empty selection the totals equal the
      // input, so nothing about the base render changes when the feature is idle.
      // NOTE: authored-only; loadAppExports (jsdom) is not run on this machine.
      const { applySelection } = await loadAppExports();
      const res = {
        links: [
          ['Salary', 'Work', 900],
          ['Work', 'Total income', 900],
          ['Total income', 'Expenses', 400],
          ['Expenses', 'Wants', 400],
          ['Wants', 'Travel', 400],
          ['Total income', 'Savings', 500],
        ],
        income: 900, expGrp: { Wants: 400 }, sav: 500, months: 3,
      };
      const out = applySelection(res, new Set());
      expect(out.income).toBe(res.income);
      expect(out.expGrp).toEqual(res.expGrp);
      expect(out.sav).toBe(res.sav);
      expect(out.months).toBe(res.months);
      expect(out.hidden.size).toBe(0);   // nothing de-emphasized when nothing deselected
    });

    it('buildNetWorth is independent of the feature (no deselected/drill/applySelection references in its body)', () => {
      // Validates: Requirement 7.2 — the net-worth table markup path is untouched
      // by selection/drilldown. Source-inspection over the buildNetWorth() body.
      const start = script.indexOf('function buildNetWorth');
      expect(start).toBeGreaterThan(-1);
      // Slice from the function start to the next top-level `function ` or the
      // document click handler that follows it, whichever comes first.
      const after = script.slice(start + 'function buildNetWorth'.length);
      const nextFn = after.search(/\nfunction\s+\w+|\ndocument\.addEventListener/);
      const body = nextFn === -1 ? after : after.slice(0, nextFn);
      expect(body).not.toMatch(/\bdeselected\b/);
      expect(body).not.toMatch(/\bdrill\b/);
      expect(body).not.toMatch(/applySelection/);
    });
  });

  // --- Requirements 7.3 / 7.4: mobile tap targets & single-tap == click ------
  describe('Requirements 7.3 & 7.4 — mobile tap targets and tap == click', () => {
    it('has the @media (max-width:480px) rule enabling the .nodehit tap target', () => {
      // Validates: Requirement 7.3 — enlarged hit target activates at <=480px.
      expect(html).toMatch(/@media\s*\(\s*max-width\s*:\s*480px\s*\)\s*\{[^}]*\.node\s+\.nodehit\s*\{[^}]*pointer-events\s*:\s*auto/);
      // inert on desktop by default
      expect(html).toMatch(/\.node\s+\.nodehit\s*\{[^}]*pointer-events\s*:\s*none/);
    });

    it('uses a >=44px (>=55 user-unit) hit rectangle for the node tap target', () => {
      // Validates: Requirement 7.3 — HITMIN=55 user units (~44 CSS px at the
      // mobile 0.8px/unit diagram scale), applied to width and height.
      expect(script).toMatch(/HITMIN\s*=\s*55/);
      expect(script).toMatch(/hw\s*=\s*Math\.max\(\s*NODEW\s*,\s*HITMIN\s*\)/);
      expect(script).toMatch(/hh\s*=\s*Math\.max\(\s*n\.h\s*,\s*HITMIN\s*\)/);
      expect(script).toMatch(/setAttribute\(\s*['"]class['"]\s*,\s*['"]nodehit['"]\s*\)/);
    });

    it("node selection and the hit rect use the 'click' event (fires on a single tap)", () => {
      // Validates: Requirement 7.4 — single tap == click for selection toggling.
      // Both the bar rect and the enlarged hit rect call toggleEntry on 'click'.
      const clickToggles = [...script.matchAll(/addEventListener\(\s*['"]click['"]\s*,\s*e\s*=>\s*\{\s*e\.stopPropagation\(\)\s*;\s*toggleEntry\(key\)/g)];
      expect(clickToggles.length).toBeGreaterThanOrEqual(2);
    });

    it("the drill control opens the drilldown on 'click' (fires on a single tap)", () => {
      // Validates: Requirement 7.4 — single tap == click for opening a drilldown.
      expect(script).toMatch(/addEventListener\(\s*['"]click['"]\s*,\s*e\s*=>\s*\{\s*e\.stopPropagation\(\)\s*;\s*openDrilldown\(\s*category\s*,\s*kind\s*\)/);
    });
  });
});
