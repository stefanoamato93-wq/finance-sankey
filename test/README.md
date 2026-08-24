# finance-sankey-web test harness (dev-only)

This folder holds the property-based and example tests for
`finance-sankey-web/index.html`. It is a **development-only** harness and is
**never referenced by `index.html`**: the shipped page stays a single,
self-contained HTML file with no build step and no runtime dependency. Nothing
in this folder is deployed to GitHub Pages.

## How the tests reach the app code

`index.html` ends with a guarded export shim:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseCSV, aggregate, computeLinks, detailFor /* + helpers as they land */ };
}
```

In the browser there is no `module` global, so the block never runs and adds
zero cost. In Node the harness evaluates the page's inline `<script>` inside a
jsdom window (see `load-app.js`) and reads the exported pure helpers. The export
list grows as later tasks add `SheetCache`, `thickness`, `idxFromClientX`,
`isMobile`, etc.

## Running

```
npm install
npm test
```

- Runner: [Vitest](https://vitest.dev/) (`vitest run`).
- Property tests: [fast-check](https://github.com/dubzzz/fast-check), min 100
  iterations each, one test per design property, tagged
  `Feature: finance-sankey-perf-mobile, Property N: ...`.

## Isolation guarantees (verified by `harness.test.js`)

- `index.html` contains the guarded shim (inert in the browser).
- `index.html` references no external `script`/`link`/`import` (self-contained).
- `index.html` never references this `test/` folder.
