// Task 1.1 smoke test: the export shim is present + inert, index.html stays a
// self-contained single file, and it never references this test/ folder.
import { describe, it, expect } from 'vitest';
import { readIndexHtml, extractInlineScript } from './load-app.js';

describe('finance-sankey-perf-mobile test harness setup', () => {
  const html = readIndexHtml();

  it('index.html contains the guarded, browser-inert export shim', () => {
    expect(html).toMatch(/typeof module !== 'undefined' && module\.exports/);
    expect(html).toMatch(/module\.exports\s*=\s*\{[^}]*parseCSV[^}]*\}/);
  });

  it('the shim guard makes the export block inert in the browser (no module global)', () => {
    // Simulate the browser: `module` is undefined -> the guard short-circuits.
    let ran = false;
    const simulateBrowser = new Function(
      "if (typeof module !== 'undefined' && module.exports) { arguments[0](); }"
    );
    simulateBrowser(() => { ran = true; });
    expect(ran).toBe(false);
  });

  it('index.html has no external script/link/import (stays self-contained)', () => {
    expect(html).not.toMatch(/<script[^>]*\bsrc=/i);
    expect(html).not.toMatch(/<link[^>]*\bhref=/i);
    expect(html).not.toMatch(/\bimport\s+[^;]*from\s+['"]/);
  });

  it('index.html never references the test/ folder', () => {
    expect(html).not.toMatch(/test\//);
  });

  it('the inline application script is extractable and defines the exported helpers', () => {
    const script = extractInlineScript(html);
    for (const name of ['parseCSV', 'aggregate', 'computeLinks', 'detailFor']) {
      expect(script).toMatch(new RegExp('function\\s+' + name + '\\b'));
    }
  });
});
