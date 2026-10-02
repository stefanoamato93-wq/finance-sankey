# Personal finance

A single, self-contained web page that renders a money-flow **Sankey diagram**
and a detailed **assets & liabilities table** from a Google Sheet. No build step,
no dependencies, no data stored in this repo — it reads the sheet live in the
browser.

**Live:** https://stefanoamato93-wq.github.io/finance-sankey/

## Page order
1. Title (**Personal Finance**, title case; section titles too).
2. **Net worth hero card**: the only headline box. Big net-worth value, a sub-line
   with just `LIVE HH:MM` (or the latest month when live prices are unavailable), a
   **trend sparkline** of month-end net worth on the right.
3. **Assets & Liabilities** section: the Assets and Liabilities tables (side by
   side on wide screens, stacked on phones), each with its total on top, collapsed
   by category (Expand all / Collapse all cover both).
4. **Cash Flow** section (separated by a thin rule): period controls, range bar,
   Income / Expenses / Savings / Safe savings cards, then the money-flow **Sankey**.
5. **Cash Flow vs Savings** chart (see below), under the Sankey.

### Cash Flow vs Savings (yearly bars + savings-rate lines)
One column per calendar year, **actuals only**: first year of data up to the
current month (rows dated after today are ignored, no forecast years). The current
year is labelled `YTD` under its year; any other part year shows its month count.
- **Bars up = income**, stacked **Safe** (Base + TFR + Food tickets, dark green),
  **Stocks** (mid green), **Other** (every other income, light green). Total on top.
- **Bars down = expenses**, stacked **Needs / Wants / Liberality / Taxes** (dark to
  light red; an "Other exp." tier appears only if the sheet has one). Total below
  in red. Taxes are included, so the totals match the Expenses card and the Sankey
  (the original sheet chart this replicates left them out, about 1 point of rate).
- **Lines** in their own band above the bars, with their own % scale:
  **Saved % income** = (income - expenses) / income (solid, label above) and
  **Saved % safe** = (safe income - expenses) / safe income (dashed, label below).
- **Toggles:** `Avg/m` divides each year by the months of that year present in the
  data (same rule as the detail panel's Yearly trend), `K` applies to every label.
  Rates do not change with Avg/m. Like the Yearly trend it ignores the range bar.
- **Exclusions count:** an entry excluded from metrics (income or expense leaf, or a
  macro group, same `deselected` keys as the Sankey) drops out of the bars and both
  rates; "Include all" restores it. `renderCashBars()` runs from every `build()` but
  only redraws when data, exclusions, Avg/m, K or the width changed (signature
  check), so dragging the range bar does not rebuild it.
- **Picker (`#cfSel`, right of the chart title):** `Overview` (the stacks + savings
  % lines) or any single entry plotted as one bar per year, in which case **the
  savings % lines disappear**. Options, in Sankey order: Income (Total income, Safe
  income, each income group and its leaves), Savings (Savings, Safe savings, which
  can go negative and then draw downwards in red), Expenses (Total expenses), then
  one group per macro group (Needs, Wants, ...) with "All needs", each label and,
  indented under it, its DETAIL sub-categories (only when a label has more than
  one). Leaves and details use the Stable_Order rank. The select turns green while
  an entry is picked. Avg/m and K apply; the tooltip shows the value and its share of
  that year's income (Safe savings: of safe income).
  - Exclusions in series mode: totals honour every exclusion, a group honours the
    exclusions of its own leaves (not of itself, since you picked it), a label or a
    detail ignores exclusions. Avg/m month counts never change with exclusions.
  - Code: pure `cfSeriesByYear(sel, DATA, DETAIL, lastMi, excluded)` (exported in
    the test shim) returns `{year: value}`; `buildCfOptions()` rebuilds the list
    once per data load (`CF_OPTS` = key -> label / colour / share base) and keeps the
    pick across refreshes when it still exists.
- **R12M pill (left of the picker):** swaps the yearly bars for a **rolling 12-month
  stacked area chart** with one point per month, from the first month of data to the
  **last complete month** (so the last point equals the T12M cards, e.g. Sep 2026 =
  101.468 income / 52.960 expenses). Each point = sum of the last 12 months, so 2018
  ramps up from zero; with **Avg/m** it is that sum / 12. Translucent ("blended")
  layers with a solid edge, y grid with values, one x label per year. What is
  stacked follows the picker:
  - Overview: income tiers up (Safe / Stocks / Other), expense groups down, plus the
    rolling Saved % income (solid) and % safe (dashed) in a band above, last value
    labelled at the right end.
  - Total income, Safe income, an income group: its income leaves.
  - Total expenses, a macro group: its labels.
  - **Stack order = Sankey order:** macro groups in `ORDER` from the zero line up
    (Needs at the bottom, then Wants, Liberality, Taxes; Work income below
    Non-work income), Stable_Order inside each group (biggest at the bottom of its
    group). When several groups are stacked (Total expenses / Total income / Safe
    income) each layer is tinted with its Sankey group colour (Needs blues, Wants
    oranges, Liberality purples, Taxes reds), darker at the bottom of the group, so
    the groups read as blocks; a single group or a label's details use the palette.
    Past 12 layers (`CF_ROLL_MAX`) the smallest fold into one grey "Other <group>
    (n)" layer per group, at the top of that group; a lone leftover keeps its name.
  - A label: its DETAIL sub-categories.
  - An income leaf, a detail, Savings, Safe savings: one signed area.
  Exclusions follow the picker rules above. Hover / tap snaps to the nearest month
  with a guide line; the tooltip lists every layer (value and % of the stack; in
  Overview the income, expense and savings split with both rolling rates). Pure
  helpers `cfRollLayers()` and `rolling12()` are exported in the test shim; the
  yearly helper `cfSeriesByYear()` takes an optional `bucket` (`mi=>mi` for monthly).
- **No legend.** The colour keys show only in the hover (desktop) / tap (phone)
  tooltip: a swatch per tier, the solid / dashed line keys next to the two rates,
  plus total and safe savings and an "N excluded" note. Tap elsewhere hides it.
- Drawn at the frame's real pixel width (`viewBox` = measured width, redrawn on
  resize), so text stays legible on phones without a sideways scroll; value labels
  shrink only when they would not fit their column.
- Code: pure `cashFlowByYear(DATA, lastMi)` (exported in the test shim) plus
  `renderCashBars()`; tiers and colours in `CF_SAFE`, `CF_INC`, `CF_EXP`. To change
  what counts as safe income, edit `CF_SAFE` (DB `DETAIL` names, upper case).

The section frames (`#nwwrap`) and titles (`#nwhead`, `#cfhead`) stay hidden until
the data has loaded, so no empty box shows above the skeleton; the skeleton mirrors
this order (hero, table rows, controls, range, cards, Sankey).

**One shared column.** The hero card, the tables frame, the range bar, the
Income/Expenses/Savings row and the Sankey frame all use the same 26px left margin
and **940px max width**, so their left and right edges line up. The
totals row is a **4-column grid** (`.totals`: Income / Expenses / Savings / Safe
savings) with equal-height cards (reserved sub-line height); four across on phones
too, with tighter type (9px labels, 14.5px values).

**Sparkline scrubber:** the trend line (`#sparkbox`) is draggable. Mouse: hover
anywhere on it; touch / pen: tap or drag horizontally (`touch-action:pan-y`, so a
vertical swipe still scrolls the page). It snaps to the nearest month, draws a
guide line and a dot on the curve, and the middle of the label row shows
`Mon YYYY · value` (otherwise a muted "drag the line" hint). Leaving with the mouse
clears it. Values match the sheet's MONTHLYVIEW "NET WORTH (END OF MONTH)" row
(e.g. Jan 2018 −31.338).

**Investment gains strip:** a second row inside the hero card with three chips,
**This month / This year / All time**, each with € gain and %. Read (read-only) from
the NETWORTH totals row (the row whose column A is `VARIABILITY`): H/I month, K/L
year, N/O all time, i.e. the sum of the per-holding deltas the sheet computes with
`GOOGLEFINANCE`. Fetched in the same `loadLive()` call (`NETWORTH!A11:O80`), stored
as `LIVE.inv`; the strip is hidden if the live read fails.

**Sparkline series:** running sum of every holding's flows per month, starting at
the cash-flow history start (`META.minMi`) with anything earlier carried into the
opening balance. It deliberately does NOT start at `META.allMinMi`, because a blank
sheet date parses as Dec 1899 and would flatten the line.

**Favicon:** an inline SVG data-URI `<link rel="icon">` in `<head>` (a mini Sankey:
green income bar splitting into needs / wants / savings bands on a dark tile), so
the tab, and a pinned Chrome tab, shows the app icon instead of the generic globe.
It is embedded, so the page stays a single self-contained file. Chrome caches
favicons, so after a change hard-refresh or unpin/re-pin the tab.

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
- **Fixed category order (Stable_Order).** Categories keep the same slot whatever
  window is selected, so dragging the range bar shows each one grow or shrink in
  place instead of reshuffling. Leaves are ranked **once per data load** by their
  total over the **latest trailing 12 months**, then by all-time total (for
  categories absent from the last 12 months), then by name. Groups follow the fixed
  `ORDER` list (now including "Other income" / "Other"). The same rank orders the
  detail panel's breakdown and the hover preview. Helpers: `stableRank()` (built at
  the end of `aggregate()` into `RANK`) and `rankCmp()`.
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
- Totals cards on top: **Income, Expenses, Savings, Safe savings**, each with its %
  of income. **Safe savings** = safe income (Base + TFR + Food tickets, `CF_SAFE`)
  minus expenses, sub-line `% of safe` (one decimal); it follows the window, Avg/m
  and exclusions like the other cards (safe income is read from the
  selection-adjusted income leaf links), and turns red when negative. The Needs / Wants / Liberality / Taxes sub-boxes were removed; those
  splits still show on the Sankey and its mid-node labels.
- The page shows the **title only** (descriptive subtitles removed from the
  header and from the section titles: no "tap a category" or "income, expenses and
  savings" hints).
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
- **Default view: T12M = the latest 12 COMPLETE months.** The app opens in T12M
  ending on the **last complete month** (`lastCompleteMi()` = the calendar month
  before today, clamped to the data), not the current part-month: on 2 Oct 2026 it
  shows **Oct 2025 - Sep 2026**. Switching to T12M again (pill or select) snaps back
  to that window; the Year / Month pickers can still re-anchor it afterwards. A data
  refresh keeps whatever window the user has moved to.
- **Compact controls:** Quick set select (`T12M` / `Month` / `Year` / `All time`, no
  "Quick set" label), Year, Month, then two segmented groups (`.pills`):
  - **Presets** `This M | Last M | T12M`: *This M* = the current (in-progress)
    month (`currentMi()`), *Last M* = the last complete month, both as a single-month
    view; each lights green while the window is exactly that month. *T12M* is the
    trailing-12 toggle.
  - **Toggles** `Avg/m | K`.
  Toggle pills are `<label>`s wrapping the original checkboxes (`#t12`, `#tMonthly`,
  `#tK`, visually hidden), so the toggle logic is unchanged; a checked pill turns
  green (`:has(input:checked)`), and the full meaning is in each tooltip. Desktop:
  one row. Phone: row 1 = presets (left) + toggles (right), row 2 = the three
  selects sharing the width (slim custom-arrow selects).
- **Trailing 12 months flag (T12M pill):** switches between the
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
  - **1-month window fix:** when the window is a single month the two handles sit
    on top of each other and the top one was clamped so it could never move left,
    which froze the bar. Now, in **Single month** mode, dragging the handle slides
    the month back and forth; in any other mode, the first move decides the side
    (drag left widens the start, drag right widens the end). Moves that do not
    change the months skip the re-render, which keeps dragging smooth.
- **Per month (avg)** toggle divides every value by the number of months in the
  selected window (a partial current year divides by the elapsed months). It also
  switches the true-scale reference to a single-month basis.
- **Values in K** toggle (applies to the Sankey and the net-worth table). Default
  is **off** (full values); when on, K values are shown to **one decimal**.
- **Number format** is fixed Italian style, independent of the browser locale:
  `fmt()` uses the `grp()` helper to put a **dot on every thousand** (`5.139`,
  `1.234.567`, including 4-digit numbers, which `toLocaleString()` left ungrouped
  in some locales) and a **comma for the K decimal** (`15,3K`).

### Assets & liabilities table
One row per **holding**, keyed by `VARIABLE` × `ASSETCLASSDETAILS` × `ACCOUNT` ×
`CATEGORY3`, showing only the **current balance** — the cumulative of *every*
transaction up to the latest month (includes appreciation, transfers and
liabilities, not just cash flow). The old Δ Month / Δ Year / Δ Overall columns and
their calculations were removed (they were unreliable); the table is a clean
value-only view.

- **Only a Net worth box above the tables** (see Page order); the Total assets and
  Total liabilities boxes were removed because each table now opens with its total.
  Liabilities = the `LIABILITIES` category only, not "every negative row", so a
  negative cash balance such as a credit-card line reduces assets rather than
  counting as a liability.
- **Two columns only, so it fits a phone.** The table is `Category / account | Value`
  with a fixed layout, wrapping names and no horizontal scroll at any width; the
  asset-class detail rides as a small muted second line under the account name
  (always shown, even when it repeats the account, e.g. `Cash / Cash`,
  `Credits / Credits`, `Realestate / Realestate`).
- **Collapsed by category, expand on click.** The table lists **accounts and their
  values**, grouped by `CATEGORY3`. Only the category rows (name and subtotal; no
  account count) show by default; **clicking a category** reveals its account rows
  underneath. Clicking again collapses it. Rows are keyboard-operable (Enter /
  Space) and the expanded set survives a re-render, so toggling **values in K** does
  not collapse everything.
- **CREDITS / DEBTS drill-down by DETAIL.** Only the `CREDITS` and `DEBTS` accounts
  (`DETAIL_ACCTS`) carry per-`DETAIL` flows (`h.det`, built in `aggregate()`). Their
  account row has a ▸ and is tappable (click / Enter / Space): it opens one muted
  line per DETAIL with its current balance, largest first, zero balances hidden
  (e.g. Andrew 3.000, HousingDeposit 2.265, Andrew_Phone 147; Debts: IJPACapGain
  (394), Argentina-Jan27 (311), Presents (200)). DETAIL names keep the sheet's
  spelling. The open set (`nwDetOpen`) survives re-renders; **Collapse all** also
  closes it.
- **Expand all / Collapse all.** Two small buttons above the table open or close
  every category in one click (each is disabled when it would do nothing).
- **Ordering:** categories by absolute subtotal (largest positions first), accounts
  inside a category by value (high → low).
- The `VARIABLE` (variability) grouping level was removed from the table; it is
  still part of the holding key used to compute balances.

- **Two tables: Assets first, Liabilities after.** `table.nw.assets` holds every
  category except `LIABILITIES`; `table.nw.liab` (red accent) sits underneath with
  the `LIABILITIES` category. Both use the same collapsible category rows, both
  start **fully collapsed**, and **Expand all / Collapse all** act on both tables
  at once. Liability accounts sort largest debt first. Built by the `table()`
  helper inside `buildNetWorth()`; a table is skipped when it has no rows.
- **Total on top.** The header row of each table (`thead tr.nwtotal`) is its total:
  **Total assets** (green) and **Total liabilities** (red), summing every category
  in that table whether open or collapsed. They match the headline cards.
- **Layout:** the two tables sit in `.nwgrid`, side by side above 760px and stacked
  below it; a lone table spans the full width.

Liabilities show as negative values in parentheses (red). Both the Sankey and the
net-worth table are wrapped in a **framed panel** (bordered, rounded).

### Live ETF values (real-time net worth)
The DB tab only books ETF values at month end, so the table would lag the market.
`loadLive()` overlays live values, **read-only** (plain GETs of the public gviz JSON
export, the same access the DB load uses; the app never writes to the sheet):

- **`LIST!V2:Y60`** = KEY | BROKER | ETF | **shares held**.
- **`NETWORTH!A11:O80`** = the sheet's own net worth table (row 11 = totals, used for
  the investment gains strip); column F is
  shares × `GOOGLEFINANCE` price, so **price per share = F / shares**.
- Each ETF holding whose `ACCOUNT|ASSETCLASSDETAILS` matches a `BROKER|ETF` with
  shares > 0 is valued at **shares × live price**. The **CAPGAIN** liability (tax on
  unrealised gains) takes its live NETWORTH value too, since it moves with prices.
- Live rows show a green **LIVE** tag and `shares × price` on the sub-line (e.g.
  `LIVE · Vwce · 1.091 × 170,80`); the hero card's sub-line is just `LIVE HH:MM`
  (no "ETF prices" text, no 12-month change), and
  the sparkline's last point becomes the live net worth.
- Runs in parallel with the DB load, then every **5 minutes** while the tab is
  visible and on returning to the tab. Any failure is silent and the DB values stay.
- Freshness is whatever Google last computed for `GOOGLEFINANCE` (usually up to
  ~20 min delayed). A LIST entry with no matching NETWORTH row (e.g. `DIRECTA|AMZN`,
  not yet in DB/NETWORTH) has no price and is ignored.
- Reconciled Oct 2026: app total vs `NETWORTH!F11` differs by ~1 € (rounding of
  DB rows).

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
