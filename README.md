# Personal finance

A single, self-contained web page that renders a money-flow **Sankey diagram**
and a detailed **assets & liabilities table** from a Google Sheet. No build step,
no dependencies, no data stored in this repo — it reads the sheet live in the
browser.

**Live:** https://stefanoamato93-wq.github.io/finance-sankey/

## Page order
1. Title (**Personal finance**).
2. **Headline cards: Net worth / Total assets / Total liabilities** (top of the page).
3. Period controls + the money-flow **Sankey**.
4. **Assets & liabilities** table (collapsed by category).

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
- **True-scale sizing, per comparison mode:** node/flow thickness uses a
  **fixed € → pixels scale**, so the whole diagram grows or shrinks with the
  absolute size of the selected period. The scale reference now adapts to the
  **Quick-set comparison mode** so the diagram is **consistent within a mode but
  readable across modes** (a single month no longer renders against a full-history
  reference and vice versa):
  - **Trailing 12 months** → largest total income of any complete 12-consecutive-
    month window (falls back to the sum of all months when fewer than 12 exist).
  - **Single month** → largest single-month income.
  - **Full year** → largest calendar-year total income.
  - **All time** → total income over the full history.
  Within a mode the reference is fixed, so shifting or resizing the window keeps
  euro-to-pixel sizing identical (two same-type windows are directly comparable);
  switching mode recomputes it. The **per month (avg)** toggle divides the active
  mode's reference by that mode's window length. Each reference is the *maximum*
  income of its mode, so the largest window fills the canvas and nothing clips;
  references are floored to a positive value so heights stay finite even with zero
  income. Implemented by `scaleReferenceFor(mode, monthly, refs)` reading the
  per-mode `META.refs` computed once in `aggregate()`.
- **Labels never run over the diagram.** Leaf names are **clipped with an ellipsis**
  to the gutter they live in (the full name stays as a hover/long-press tooltip),
  mid-node labels are clipped to the gap between two layers, the gutters were
  widened (152 / 200), and the minimum slot per node went from 22 to 27 so two
  adjacent labels always clear each other, including at the larger mobile font.
- **Click any entry → detail panel.** Clicking or tapping a node (income leaf,
  income group, expense macro group, expense leaf, or the Total income / Expenses /
  Savings hubs) opens one overlay with:
  - **Breakdown:** a **nested Sankey** of what that entry is made of — an expense
    category breaks into its `DETAIL` sub-categories, a macro group or a hub breaks
    into its leaves. Rows are clickable, so you can keep drilling; a breadcrumb
    walks back up.
  - **Monthly trend:** the month-by-month bar chart for that entry (one bar per
    calendar month in the window, zero-height where there is no activity, values
    honouring the K toggle, empty-state message when there is nothing). Entries with
    nothing to break down (income leaves, detail rows) open straight on this view.
  - **Yearly trend:** the same bar chart rolled up to **one bar per calendar year,
    all-time**. Unlike every other view it is **window-independent**: it always
    spans the first year in the sheet (2018) to the latest, so you see the whole
    history side by side no matter what the period selector says. Years with no
    activity still get a zero bar, so the axis stays continuous. Labels are
    horizontal (not slanted) and bars are wider, since there are only a handful.
    With **per month (avg)** ticked, each year shows its own per-month average
    (year total ÷ months of that year present in the data), which keeps the
    current, part-complete year comparable to the closed ones. Subtitle reads
    `<total> · <first year> — <last year> · all time`.
  - **Exclude from metrics / Include in metrics:** the only way to take an entry out
    of the numbers, so a tap on the diagram no longer silently changes the totals.
  The panel follows the top period selector (window, mode, per-month toggle) without
  tearing down the Sankey, and closes with the button, `Esc`, or a tap outside. The
  Yearly trend is the exception: it ignores the window by design (the per-month
  toggle still applies to it).
- **Interactive exclusion:** excluded entries render greyed and de-emphasized
  (reduced opacity, grayscale) as still-tappable stubs, and are out of node/flow
  sizing and the totals. Exclusion is kept by category identity, so it **survives
  period changes**. A **"N excluded · Include all"** pill appears in the controls row
  whenever something is excluded, so exclusions are always visible and reversible in
  one tap. Nothing excluded = everything counted.
- **Selection-aware totals & savings %:** the Income / Expenses / Savings cards
  and the **savings percentage** recompute from the current selection. Savings % =
  (selected income − selected expenses) ÷ selected income × 100, to one decimal
  (negative allowed); when selected income is zero (e.g. all income deselected) it
  shows a `—` placeholder instead of dividing. Helper: `savingsPercentage()`.
- **No per-name chart glyphs.** The small bar-chart icons that used to sit next to
  every label are gone; the monthly trend moved into the detail panel above. Trend
  series come from `monthlySeries(kind, category, miF, miT, DATA, DETAIL)` for
  leaves and details, and from `seriesOf(p, miF, miT)` for groups, the hubs and
  Savings (savings per month = income + expenses, since expenses are stored
  negative). `seriesOf()` defaults to the active window; the Yearly trend calls it
  with `allTimeSpan()` (`[META.minMi, META.maxMi]`) and folds the result with
  `bucketByYear(points) -> [{year, mi, value, months}]`. Both views then paint
  through one shared `renderTrend(p, bars, opts)` that takes
  `[{label, value}]` plus `{rotate, maxBarW}`.
- **Hover an expense category** (desktop) for a quick floating preview of its detail
  breakdown, each detail with its % of the category. It is a preview only — click to
  get the full panel.
- Totals cards on top: **Income, Expenses, Savings** only, each with its % of
  income. The Needs / Wants / Liberality / Taxes sub-boxes were removed; those
  splits still show on the Sankey and its mid-node labels.
- The page shows the **title only** (descriptive subtitles removed from the
  header; the assets & liabilities section keeps a one-line "tap a category" hint).
- **Mobile:** on narrow screens (≤680px) the whole page adapts, not just the
  Sankey. The Sankey still renders at a fixed wider width (min 720px) inside its
  own horizontally scrollable frame (with a "swipe sideways" hint) so labels stay
  ≥12px and legible, but in addition: the period controls stack full-width with
  ≥44px tap targets, the range-bar handles get an enlarged ~48px invisible touch
  area and respond to touch dragging, the two headline cards stay side by side but
  tighten up, and the assets table fits the screen in two columns (font floored at
  12px) so the page body never scrolls sideways. Tapping a node opens the detail
  panel, which scrolls inside itself (capped at 88vh). Desktop layout is unchanged.

### Period selection
- **Default view: the current (latest) month.** The app opens on single-month mode
  anchored to the most recent month in the sheet, so the first thing on screen is
  this month's expenses.
- **Trailing 12 months flag:** a checkbox next to the toggles switches between the
  current month and the trailing-12-month window. It is two-way bound to the Quick
  set dropdown (ticking it selects Trailing 12 months, and choosing a mode in the
  dropdown updates the tick), so the same Comparison_Mode drives both.
- **Quick set** dropdown: Trailing 12 months / Single month / Full year / All time
  (anchored by the Year and Month pickers).
- **Draggable range bar** (always visible): drag either end to resize the window,
  or drag the **middle band to shift the whole period** (e.g. slide a trailing-12
  window across the years and watch the numbers update live). The on-screen usage
  instructions under the bar were removed.
  - **Drag fix (landscape / touch):** `touch-action` is not inherited, so the
    handles and the middle band now set `touch-action:none` themselves — without it
    the browser claimed a horizontal drag as a pan gesture and the bar did not move.
    The drag also takes a **pointer capture** on the pressed element (so moves keep
    arriving once the finger leaves the 26px band), handles `pointercancel`, keeps
    the enlarged invisible grab area at **every** viewport width rather than only
    under 680px, and only falls back to the touch-event pipeline when
    `window.PointerEvent` is missing (running both pipelines let `touchstart`'s
    `preventDefault` cancel the in-flight pointer drag).
- **Per month (avg)** toggle divides every value by the number of months in the
  selected window (a partial current year divides by the elapsed months). It also
  switches the true-scale reference to a single-month basis.
- **Values in K** toggle (applies to the Sankey and the net-worth table). Default
  is **off** (full values); when on, K values are shown to **one decimal**.

### Assets & liabilities table
One row per **holding**, keyed by `VARIABLE` × `ASSETCLASSDETAILS` × `ACCOUNT` ×
`CATEGORY3`, showing only the **current balance** — the cumulative of *every*
transaction up to the latest month (includes appreciation, transfers and
liabilities, not just cash flow). The old Δ Month / Δ Year / Δ Overall columns and
their calculations were removed (they were unreliable); the table is a clean
value-only view.

- **Two headline cards at the top of the page**, side by side and compact: **Net
  worth** and **Total assets** (green). The Total liabilities card was dropped to
  save vertical space; liabilities are still netted out of assets (liabilities = the
  `LIABILITIES` category only, not "every negative row", so a negative cash balance
  such as a credit-card line reduces assets rather than counting as a liability) and
  the Liabilities category is still a row in the table. The cards stay side by side
  on mobile too.
- **Two columns only, so it fits a phone.** The table is `Category / account | Value`
  with a fixed layout, wrapping names and no horizontal scroll at any width; the
  asset-class detail rides as a small muted second line under the account name
  (suppressed when it just repeats the account).
- **Collapsed by category, expand on click.** The table lists **accounts and their
  values**, grouped by `CATEGORY3`. Only the category rows (with their subtotal and
  account count) show by default; **clicking a category** reveals its account rows
  underneath. Clicking again collapses it. Rows are keyboard-operable (Enter /
  Space) and the expanded set survives a re-render, so toggling **values in K** does
  not collapse everything.
- **Expand all / Collapse all.** Two small buttons above the table open or close
  every category in one click (each is disabled when it would do nothing).
- **Ordering:** categories by absolute subtotal (largest positions first), accounts
  inside a category by value (high → low).
- The `VARIABLE` (variability) grouping level was removed from the table; it is
  still part of the holding key used to compute balances.

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
- A **skeleton placeholder** (CSS-only shimmer mirroring the controls, cards,
  Sankey and table) is in the initial markup, so it paints immediately with no JS
  and is hidden the moment real content renders (no blank/unstyled gap). It
  respects `prefers-reduced-motion`.
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

## Tests (dev-only, not shipped)
The `test/` folder holds a Node (vitest) / fast-check harness for the pure helpers
(`parseCSV`, `aggregate`, `computeLinks`, `applySelection`, `savingsPercentage`,
`monthlySeries`, `detailFor`, `SheetCache`, `fetchSheet`, `isMobile`,
`scaleReferenceFor`). It is **never referenced by `index.html`** — the page stays a
single self-contained file. A tiny guarded export shim at the end of the inline
script (`if (typeof module !== 'undefined' && module.exports) { … }`) exposes those
helpers to Node and is completely inert in the browser. Running the suite needs
Node (`cd test && npm install && npm test`).

The interactive-drilldown feature added property/example suites
(`scale-engine`, `scale-canvas-bound`, `selection-state`, `apply-selection`,
`savings-percentage`, `monthly-series`, `drilldown-selection-independence`,
`rendering-regression`, `data-path-smoke`) covering the 11 correctness properties
in the spec.

> **Note:** these suites are **committed as source but have not been executed** on
> the maintainer's machine. The Node/vitest harness only runs inside WSL (where
> the `W:` working copy is not mounted), while the app itself is edited from the
> Windows side. The suites are runnable in any environment with Node + the working
> tree; the practical verification for this app is **manual / in-browser**.

## Local variant
The sibling folder `Personal Finance/` also has an offline builder
(`build_sankey.py` → `sankey.html`) that embeds a snapshot of `FullDB.xlsx`
instead of reading the live sheet.
