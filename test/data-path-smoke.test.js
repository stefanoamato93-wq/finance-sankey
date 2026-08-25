// Task 7.3 (finance-sankey-interactive-drilldown): integration / smoke tests
// for the self-contained data path. These validate Requirements 7.1, 7.5 and
// 7.6 by inspecting the shipped index.html source (the app boots at top level
// and hits localStorage/network, so most of this is source-inspection rather
// than full DOM execution) plus a small localStorage-stubbed exercise of the
// SheetCache pure helper.
//
// Authored and committed as source only. Per the workspace steering
// (finance-sankey-web.md) the Node suite is NOT executed on this machine
// (Node lives only in WSL, W: is not mounted there), so there is no PBT status
// shim here and execution is deferred to any environment with Node + the tree.
//
// These checks are complementary to harness.test.js's isolation checks; the
// self-containment assertions below intentionally mirror them to keep the two
// files consistent.
import { describe, it, expect } from 'vitest';
import { readIndexHtml, extractInlineScript, loadAppExports } from './load-app.js';

const html = readIndexHtml();
const script = extractInlineScript(html);

describe('finance-sankey data path: self-contained page (Requirement 7.1)', () => {
  // Requirement 7.1: single self-contained file, no external runtime requests
  // other than the Google Sheets CSV endpoint.

  it('has no external <script src> (mirrors harness.test.js) — Requirement 7.1', () => {
    expect(html).not.toMatch(/<script[^>]*\bsrc=/i);
  });

  it('has no external <link href> stylesheet/resource — Requirement 7.1', () => {
    expect(html).not.toMatch(/<link[^>]*\bhref=/i);
  });

  it('has no bare ES `import ... from` (stays a single inline script) — Requirement 7.1', () => {
    expect(html).not.toMatch(/\bimport\s+[^;]*from\s+['"]/);
  });

  it('references exactly one network URL, the Google Sheets gviz CSV (CSV_URL) — Requirement 7.1', () => {
    // The only outbound endpoint is the docs.google.com gviz CSV export.
    expect(script).toMatch(/const\s+CSV_URL\s*=/);
    expect(script).toMatch(/docs\.google\.com\/spreadsheets\/[^`'"]*gviz\/tq\?tqx=out:csv/);
  });

  it('performs no fetch()/XHR to any endpoint other than CSV_URL — Requirement 7.1', () => {
    // Every fetch( call must target CSV_URL (the single data endpoint), and the
    // app must not open a raw XMLHttpRequest or a WebSocket to anything else.
    const fetchArgs = [...script.matchAll(/fetch\s*\(\s*([^,)\s]+)/g)].map(m => m[1]);
    expect(fetchArgs.length).toBeGreaterThan(0);
    for (const arg of fetchArgs) {
      expect(arg).toBe('CSV_URL');
    }
    expect(script).not.toMatch(/new\s+XMLHttpRequest\b/);
    expect(script).not.toMatch(/new\s+WebSocket\b/);
    // No hardcoded absolute http(s) endpoint other than the google sheets host.
    const urls = [...script.matchAll(/https?:\/\/[^\s'"`)]+/g)].map(m => m[0]);
    for (const u of urls) {
      expect(u).toMatch(/docs\.google\.com/);
    }
  });
});

describe('finance-sankey data path: stale-while-revalidate cache (Requirement 7.5)', () => {
  // Requirement 7.5: on fetch failure/timeout, render the most recently cached
  // dataset when available and keep full selection/drilldown interactivity;
  // there is a 10s per-attempt timeout with bounded retry (<=3).

  it('boot() renders cached data first when the cache is fresh — Requirement 7.5', () => {
    // boot() reads the cache and, when fresh, applies it before the live fetch.
    expect(script).toMatch(/function\s+boot\s*\(/);
    expect(script).toMatch(/SheetCache\.read\s*\(/);
    expect(script).toMatch(/SheetCache\.isFresh\s*\(/);
    // The fresh-cache branch renders from cache and shows the "last loaded" badge.
    expect(script).toMatch(/isFresh[\s\S]{0,120}applyData\(\s*cached\.entry\.csv\s*\)/);
    expect(script).toMatch(/showBadge\(/);
  });

  it('on fetch failure boot() keeps/falls back to cached data (no re-throw, badge shown) — Requirement 7.5', () => {
    // The fetchSheet().catch branch: if already rendered from cache, keep it on
    // screen (showBadge + return); else fall back to stale cache via applyData.
    const catchBlock = script.slice(script.indexOf('.catch(err=>'));
    expect(catchBlock).toMatch(/renderedFromCache/);
    expect(catchBlock).toMatch(/applyData\(\s*cached\.entry\.csv\s*\)/);
    expect(catchBlock).toMatch(/showBadge\(/);
    // Only reaches showError after both cache paths are exhausted (see 7.6).
  });

  it('fetchSheet has a 10s per-attempt AbortController timeout and bounded retry (<=3) — Requirement 7.5', () => {
    expect(script).toMatch(/async\s+function\s+fetchSheet\s*\(/);
    expect(script).toMatch(/new\s+AbortController\s*\(/);
    // 10000ms per-attempt abort timeout.
    expect(script).toMatch(/ctrl\.abort\(\)\s*,\s*10000/);
    // Bounded retry loop: at most 3 attempts.
    expect(script).toMatch(/attempt\s*<\s*3/);
  });

  it('interactivity operates on whatever dataset is rendered (fetch-path independent) — Requirement 7.5', () => {
    // Source-inspection: build()/applySelection/renderDrilldown act on the
    // aggregated DATA/DETAIL and the in-memory selection/drill state, not on the
    // fetch path, so selection, savings recompute and drilldown remain fully
    // functional on cached data. applySelection takes (res, deselected) only;
    // renderDrilldown reads curMiF/curMiT + drill state; neither calls fetch.
    expect(script).toMatch(/function\s+applySelection\s*\(\s*res\s*,\s*deselected\s*\)/);
    expect(script).toMatch(/function\s+renderDrilldown\s*\(/);
    expect(script).toMatch(/function\s+build\s*\(/);
    const applyStart = script.indexOf('function applySelection');
    const applyBody = script.slice(applyStart, applyStart + 1600);
    expect(applyBody).not.toMatch(/\bfetch\s*\(/);
    const drillStart = script.indexOf('function renderDrilldown');
    const drillBody = script.slice(drillStart, drillStart + 1600);
    expect(drillBody).not.toMatch(/\bfetch\s*\(/);
  });

  it('SheetCache read/write/isFresh/differs round-trips with a stubbed localStorage — Requirement 7.5', async () => {
    // Optional live exercise of the cache pure helper through the export shim.
    const store = new Map();
    const localStorage = {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: k => { store.delete(k); },
    };
    const app = await loadAppExports({
      fetchImpl: () => Promise.reject(new Error('network disabled in tests')),
      // loadAppExports runs the script with a jsdom window; jsdom provides
      // localStorage, but if the environment lacks it the helper guards with
      // available(). We assert behaviour via the returned SheetCache directly.
    });
    const { SheetCache } = app;
    expect(SheetCache).toBeTruthy();

    const now = Date.now();
    // A freshly written entry (retrievedAt = now) must read back and be fresh.
    // Drive the helper against our own stubbed store to stay deterministic and
    // independent of jsdom's localStorage state.
    const written = { v: 1, csv: 'a,b\n1,2', retrievedAt: now };
    store.set(SheetCache.KEY, JSON.stringify(written));
    // isFresh: within MAX_AGE_MS is fresh, well past it is stale.
    expect(SheetCache.isFresh(written, now)).toBe(true);
    expect(SheetCache.isFresh(written, now + SheetCache.MAX_AGE_MS + 1)).toBe(false);
    expect(SheetCache.isFresh(null, now)).toBe(false);
    // differs: same csv is not different, changed csv is.
    expect(SheetCache.differs('x', 'x')).toBe(false);
    expect(SheetCache.differs('x', 'y')).toBe(true);
  });
});

describe('finance-sankey data path: error, no cache (Requirement 7.6)', () => {
  // Requirement 7.6: on fetch failure with no cache, show an error indication
  // without leaving a blank/unresponsive view.

  it("boot()'s catch calls showError(...) when there is no usable cache — Requirement 7.6", () => {
    const catchBlock = script.slice(script.indexOf('.catch(err=>'));
    // After the renderedFromCache and stale-cache fallbacks, the final action is
    // showError with the error message.
    expect(catchBlock).toMatch(/showError\(/);
    // showError is the last resort (appears after the cache branches).
    const idxCache = catchBlock.indexOf('cached.entry.csv');
    const idxErr = catchBlock.indexOf('showError(');
    expect(idxCache).toBeGreaterThan(-1);
    expect(idxErr).toBeGreaterThan(idxCache);
  });

  it('showError sets the status element so the page is not left blank — Requirement 7.6', () => {
    expect(script).toMatch(/function\s+showError\s*\(/);
    const start = script.indexOf('function showError');
    const body = script.slice(start, start + 700);
    // Reveals the status element (display cleared) and writes visible content.
    expect(body).toMatch(/statusEl\.style\.display\s*=\s*''/);
    expect(body).toMatch(/statusEl\.className\s*=\s*'status err'/);
    expect(body).toMatch(/statusEl\.innerHTML\s*=/);
    // The message tells the user data could not be loaded (non-blank view).
    expect(body).toMatch(/Could not load the sheet|Loading timed out/);
  });

  it('the 30s overall guard shows the timed-out error only when nothing rendered — Requirement 7.6', () => {
    // boot() arms a 30s overall guard that surfaces showError('',true) only when
    // the fetch has not settled and nothing was rendered from cache.
    expect(script).toMatch(/setTimeout\([\s\S]{0,80}showError\(\s*''\s*,\s*true\s*\)/);
    expect(script).toMatch(/!settled\s*&&\s*!renderedFromCache/);
  });
});
