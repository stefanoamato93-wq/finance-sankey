# Personal Finance — Sankey

A single, self-contained web page that renders a money-flow **Sankey diagram**
and a detailed **net-worth table** from a Google Sheet. No build step, no
dependencies, no data stored in this repo — it reads the sheet live in the
browser.

**Live:** https://stefanoamato93-wq.github.io/finance-sankey/

## What it shows

### Sankey (money flow)
`income sources → Work / Non-work income → Total income → Expenses / Savings →
Needs / Wants / Liberality / Taxes → category`.
- **Total income** is the central node (all income converges here). It then
  splits into a single merged **Expenses** node and **Savings** (the residual =
  income − expenses − taxes). Expenses then splits into the macro groups, which
  split into their leaf categories.
- **Mid nodes carry their monetary value** (Total income, Expenses, Savings and
  each macro group show the € amount, plus % of income where relevant).
- **True-scale sizing:** node/flow thickness uses a **fixed € → pixels scale**,
  so the whole diagram grows or shrinks with the absolute size of the selected
  period — a period with 10× the income renders visibly ~10× taller. The
  reference is the largest trailing-12-month income (or, in *per-month* mode, the
  largest single-month income), so the default view fills the canvas and other
  windows scale against it.
- **Hover an expense category** to pop up a small floating Sankey of its detail
  breakdown (from the `DETAIL` column), each detail with its % of the category.
- Totals cards on top: **Income, Expenses, Savings** only, each with its % of
  income. The Needs / Wants / Liberality / Taxes sub-boxes were removed; those
  splits still show on the Sankey and its mid-node labels.
- The page shows the **title only** (descriptive subtitles removed from the
  header and the net-worth section).
- **Mobile:** on narrow screens (≤680px) the whole page adapts, not just the
  Sankey. The Sankey still renders at a fixed wider width (min 720px) inside its
  own horizontally scrollable frame (with a "swipe sideways" hint) so labels stay
  ≥12px and legible, but in addition: the period controls stack full-width with
  ≥44px tap targets, the range-bar handles get an enlarged ~48px invisible touch
  area and respond to touch dragging, the headline cards stack in a single column,
  and the net-worth table scrolls inside its own frame (font floored at 12px) so
  the page body never scrolls sideways. On touch/no-hover devices, tapping an
  expense category opens the same detail popup that hover shows on desktop (tap
  again or tap elsewhere to close). Desktop layout is unchanged.

### Period selection
- **Quick set** dropdown: Trailing 12 months / Single month / Full year / All time
  (anchored by the Year and Month pickers).
- **Draggable range bar** (always visible): drag either end to resize the window,
  or drag the **middle band to shift the whole period** (e.g. slide a trailing-12
  window across the years and watch the numbers update live).
- **Per month (avg)** toggle divides every value by the number of months in the
  selected window (a partial current year divides by the elapsed months). It also
  switches the true-scale reference to a single-month basis.
- **Values in K** toggle (applies to the Sankey and the net-worth table). Default
  is **off** (full values); when on, K values are shown to **one decimal**.

### Net-worth table
One row per **holding**, keyed by `VARIABLE` (variability) × `ASSETCLASSDETAILS`
× `ACCOUNT` × `CATEGORY3`, showing only the **current balance** — the cumulative
of *every* transaction up to the latest month (includes appreciation, transfers
and liabilities, not just cash flow). The old Δ Month / Δ Year / Δ Overall columns
and their calculations were removed (they were unreliable); the table is now a
clean value-only view.

The layout is a **pivot**, grouped and ordered like a spreadsheet pivot table:
- **Headline cards on top:** three cards above the table — a large **Net worth**
  hero number, plus **Total liabilities** (sum of the `LIABILITIES` category only,
  red) and **Total assets** (everything else, i.e. Net worth − liabilities,
  green) — so the asset/liability split reads at a glance. Note liabilities is the
  Liabilities category, not "every negative row", so a negative cash balance
  (e.g. a credit-card line) reduces assets rather than counting as a liability.
- **Variability → Category → Account.** Rows are grouped by variability
  (`Variable` / `Nonvariable`), then by `CATEGORY3` within each. Each variability
  group and each category shows a **subtotal** row.
- **Ordered by value, highest to lowest, within the same category.** Variability
  groups and categories are ordered by their subtotal (high → low), and the leaf
  account rows are ordered by value (high → low) inside their category. Leaf rows
  show only Asset class details + Account + Value; the variability/category cells
  are left blank because the group/category headers above name them.

Liabilities show as negative values in parentheses (red). Both the Sankey and the
net-worth table are wrapped in a **framed panel** (bordered, rounded).

## Performance / loading

The page used to block on the live Google Sheet fetch, so a cold network could
leave it near-blank for up to ~10 seconds. It now uses a **stale-while-revalidate**
cache:

- The most recent raw CSV is cached in the browser's **localStorage**
  (`finance-sankey-cache-v1`, key = raw CSV text + retrieval timestamp). Nothing is
  stored server-side and nothing is sent anywhere except the existing public CSV
  endpoint, so the privacy model is unchanged.
- **Returning visits render instantly from cache** (if the cached copy is ≤24h old)
  while a fresh copy is fetched in the **background**. When the background copy
  differs, the diagram re-renders with the new data; when it is identical, nothing
  re-renders. A small **"Showing last loaded data" badge** appears while refreshing
  and if the refresh fails (the cached view stays on screen).
- The live fetch **retries up to 3 times** with a **10s timeout per attempt**, and a
  **30s overall guard** shows a timeout error if a cold load never returns. On a cold
  failure with any cached copy present (even stale), the cached copy is shown instead
  of an error.
- The Sankey is rendered first and the net-worth table on the next frame, so the
  diagram paints without waiting on the table.
- If `localStorage` is unavailable (private mode, disabled), the app silently falls
  back to a plain live fetch.

The file remains a single self-contained HTML page with no build step and no
external dependencies.

## Data source requirements
The Google Sheet must be shared as **“Anyone with the link → Viewer”** and have a
tab named **`DB`**. Columns used (extra columns are ignored):
`YEAR, MONTH, VALUE, LABEL, DETAIL, ASSETCLASSDETAILS, TYPE, CATEGORY1` for the
cash-flow Sankey, plus `ACCOUNT, VARIABLE, CATEGORY3` for the net-worth table.

Row handling:
- `TYPE=INCOME` → source = `DETAIL`, grouped by `CATEGORY1`
  (`WORKINCOME` / `NONWORKINCOME`).
- `TYPE=EXPENSES` → category = `LABEL`, grouped by `CATEGORY1`
  (`NEEDS` / `WANTS` / `LIBERALITY`).
- `TYPE=TAXES` → grouped as `Taxes`; `DETAIL=ApprecTaxes` is excluded from cash
  flow (it pairs with the excluded appreciation).
- `TYPE=TRANSFER` / `TYPE=APPRECIATION` are excluded from the cash-flow Sankey,
  but **all rows** (every type) count toward the net-worth balances.
- Net-worth holdings are the running sum of `VALUE` per
  `VARIABLE|ASSETCLASSDETAILS|ACCOUNT|CATEGORY3` at the chosen month end.

## Privacy
The page is public and reads a public sheet, so anyone with the page URL (or the
sheet's CSV URL) can see the figures. Keep only data you are comfortable exposing.

## Configuration
Change `SHEET_ID` / `SHEET_NAME` at the top of the `<script>` block. Colours for
the nodes/flows are CSS variables in `:root`.

## Local variant
The sibling folder `Personal Finance/` also has an offline builder
(`build_sankey.py` → `sankey.html`) that embeds a snapshot of `FullDB.xlsx`
instead of reading the live sheet.
