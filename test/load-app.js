// Dev-only loader: evaluates the inline <script> of ../index.html inside a
// jsdom window and returns the helpers exposed by the guarded export shim.
//
// This is used by later property/example tasks. The shipped index.html never
// imports this file; it exists only so the Node test harness can reach the
// pure helpers without duplicating them.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const INDEX_HTML_PATH = resolve(HERE, '..', 'index.html');

/** Read the raw index.html text. */
export function readIndexHtml() {
  return readFileSync(INDEX_HTML_PATH, 'utf8');
}

/** Extract the inline <script> body (the app code) from index.html. */
export function extractInlineScript(html = readIndexHtml()) {
  // The page has a single inline application <script> with no src attribute.
  const matches = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!matches.length) throw new Error('No inline <script> found in index.html');
  // Return the largest inline script (the application code).
  return matches.map(m => m[1]).sort((a, b) => b.length - a.length)[0];
}

/**
 * Evaluate the app script in a jsdom window and return `module.exports`.
 * jsdom + a stubbed fetch are required because index.html reads the DOM and
 * calls load() at the top level. Lazily imports jsdom so tests that only need
 * the raw HTML (isolation checks) do not require it to be installed.
 */
export async function loadAppExports({ fetchImpl } = {}) {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(readIndexHtml(), {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  // Never hit the network in tests; default to a rejecting fetch so load()
  // falls into its catch branch harmlessly.
  window.fetch = fetchImpl || (() => Promise.reject(new Error('network disabled in tests')));
  const moduleObj = { exports: {} };
  const script = extractInlineScript();
  const runner = new window.Function('module', 'exports', 'window', 'document', script);
  runner.call(window, moduleObj, moduleObj.exports, window, window.document);
  return moduleObj.exports;
}
