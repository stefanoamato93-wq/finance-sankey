# Personal finance

A single, self-contained web page that renders a money-flow **Sankey diagram**
and a detailed **assets & liabilities table** from a Google Sheet. No build step,
no dependencies, no data stored in this repo — it reads the sheet live in the
browser.

**Live:** https://stefanoamato93-wq.github.io/finance-sankey/

## Pages (one block per page, added 9 Oct 2026)
Title (**Personal Finance**, title case; section titles too), then a tab row with six
pages. Only the page on screen is shown **and drawn**:

| Tab | Hash | Content |
|---|---|---|
| **Net Worth** | `#networth` | Hero card (net worth, `LIVE HH:MM`, trend sparkline, investment gains) + **Assets & Liabilities** tables (side by side on wide screens, stacked on phones, totals on top, collapsed by category). |
| **Cash Flow** | `#cashflow` | Period controls, range bar, Income / Expenses / Savings / Safe savings cards, the money-flow **Sankey** and its detail panel. |
| **Savings** | `#savings` | **Cash Flow vs Savings** chart (see below); clicking a month in its month view opens the **Month detail** overlay. |
| **Compare** | `#compare` | **Period Comparison** (see below). |
| **Years Paid** | `#life` | **Years of Life Paid** (see below). |
| **Query** | `#query` | **Query** of past transactions, modelled on the sheet's QUERY tab (see below). |

- **Navigation:** desktop = a sticky tab row under the title (the Cash Flow controls
  stick right under it, `--tabsh`); phone (<=680px) = a fixed bottom tab bar with six
  equal tabs (11px labels since the Query tab was added), so the Cash Flow controls stick
  at the top as before. Tabs set the URL
  hash with `history.replaceState` (bookmarkable, no back-button clutter); opening a
  URL with a hash, or changing it, opens that page (`hashchange`).
- **Last page remembered:** a bare URL reopens the page used last
  (`finance-sankey-page-v1` in localStorage), otherwise Net Worth.
- **Lazy drawing:** every renderer returns early while its page is hidden
  (`pageOn(p)`). `showPage(p)` closes the hover preview / tooltip / detail panel, shows
  the page, draws it and restores that page's own scroll position. The Sankey and the
  net worth tables redraw on entry (a few ms); the Savings, Compare and Years Paid charts
  skip the redraw when nothing they show changed (signature checks). Dragging the range
  bar now redraws only the Sankey and its cards.
- **Shared state:** exclusions made on the Sankey, Avg/m and K apply on every page.
  The **Avg/m | K** toggles are one element (`#toggles`) that moves into the page on
  screen: the controls row on Cash Flow, the section header elsewhere. Avg/m is hidden
  on Net Worth and Years Paid, where it changes nothing. The "N excluded · Include all"
  pill stays on Cash Flow; Compare and Savings show their own "N excluded" notes.
- `buildNetWorth()` always keeps the live net worth (`NW_NOW`) current, even while Net
  Worth is hidden, so the Years Paid "Now" point is right without visiting Net Worth.
- Code: `PAGES`, `PAGE`, `pageOn()`, `syncPageUI()`, `renderPage()`, `showPage()`,
  `measureSticky()` / `onScrollSticky()`. `build()` = range + `buildSankey()` (Cash Flow
  only) + the guarded charts. Check: `_verify_pages.py [shot]` (untracked).

### Query (past transactions, filters, ranked views, drill-down)
The **Query** page, added 10 Oct 2026, modelled on the sheet's `QUERY` tab (its criteria
column, the Sum / Average cells, and the ALL TRANSACTIONS / GROUPED BY MONTH / LABEL /
DETAIL / ACCOUNT / TRENDS / FIELD OCCURRENCES blocks).
- **Data:** one row per DB transaction (date from `YEAR` / `MONTH` / `DAY`, `ACCOUNT`,
  `LABEL`, `DETAIL`, `TYPE`, `CATEGORY1`, `CATEGORY2`, `VALUE`), read the first time the page
  opens with a second gviz query without `group by` (`txURL()`: `select A,B,C,H,J,K,P,R,S,I`,
  VALUE last; ~0,9 MB, ~68 KB gzipped, 12.910 rows on 10 Oct 2026). `txOk()` checks the answer
  (every header, VALUE last, plain numbers); if it fails, the full export is read and the
  letters re-learned into `finance-sankey-txcols-v1` (`learnCols(head, TX_COLS)`). The sheet's
  blank formula rows (no year, `TYPE` `#N/A`, no VALUE) are skipped. `TAXES` rows with
  `DETAIL` `ApprecTaxes` count as **Appreciation**, as in the Sankey (not cash flow).
- **Cache and refresh:** the rows are kept in localStorage (`TxCache`,
  `finance-sankey-tx-v1`, strings in one table + a flat number array, ~0,4M characters), so a
  return visit draws at once; a background check follows. It refreshes on the DB schedule
  (10 min, 2 min on return) **only while the Query page is on screen**, and straight away when
  the DB refresh sees a new fingerprint. Same fingerprint = nothing redrawn. Nothing else is
  sent anywhere.
- **Filters** (collapsible panel; collapsed it shows a one-line summary):
  - **Dates:** From / To date pickers (day precision, both included, swapped if reversed)
    plus presets `All | This M | Last M | YTD | T12M | Last Y` (T12M = the 12 complete months,
    like elsewhere); the matching preset lights up.
  - **Type:** `Income | Expenses | Taxes | Transfer | Apprec.`, default the cash-flow three.
  - **Search** (every word must appear in account, label, detail, type, group or category 2),
    **Group** (`CATEGORY1`), **Category 2** (FOOD / NONFOOD / SAFE / NONSAFE ...), **Account**,
    **Label**, **Detail**: the sheet's syntax. Blank or `%` = any, exact match otherwise
    (case-insensitive), `%` or `*` wildcard (`ARG%`), comma = or (`FOOD, GROCERIES`), a
    leading `!` = not (`!T`). Each field suggests its values (datalist) among the rows the
    OTHER criteria leave, so the lists cascade (Label HOLIDAYS -> Detail lists the trips).
  - **Value:** `>`, `<`, `>=`, `<=`, `=`, `!=` or a range `-500..-50`; several with `, `. A
    term that does not parse turns the field red and is ignored.
  - Text fields apply 220 ms after typing stops, or on Enter. A field in use is outlined green.
  - **Reset** clears every criterion and the drill trail (types back to the cash-flow three),
    keeping the view and the sorts.
- **Cards:** Sum (sub-line `in X · out Y` when both signs are present, else the date range),
  Transactions (count, with the number of labels and details), Average (per transaction)
  and Per month (sum / calendar months of the date window, clamped to the data).
- **Views** (pills with their row counts; on a phone "Transactions" reads "Tx"):
  - **Transactions:** Date, Label, Detail, Account, Value (signed, green / red), newest first;
    300 rows, then `Show 500 more`. Values are always in full euros (K would turn them to 0K).
  - **Months / Labels / Details / Accounts:** rank, name (labels show their group, details
    their label, as a muted hint), Count, Avg, Sum, a bar (one scale per view) and Share (of
    the same-sign total). A **Total** row on top.
  - **Sort** (select, or click a header): grouped views `By size` (default: `|sum|`, so with
    expenses the most negative month / label comes first and with income the most positive),
    `Negative first`, `Positive first`, `By count`, `By average`, `By name` (Months: `By date`,
    newest first); Transactions `Newest first`, `Oldest first`, `By size`, `Negative first`,
    `Positive first`. Clicking Sum / Value cycles size -> negative first -> positive first.
- **Drill-down:** a row click (or Enter) adds its value as a criterion and opens the next
  view: **Months -> Labels -> Details -> Transactions**, **Accounts -> Labels**. A level whose
  field is already pinned to one exact value is skipped (Label HOLIDAYS set: a month opens its
  Details). The previous query goes on a back stack: a `‹ Back` pill and a crumb trail
  (`Months › Nov 2025 › HOLIDAYS › Weekend`, any crumb jumps back there), and Esc steps back
  (not while typing in a field). The criteria, view and sorts are kept in localStorage
  (`finance-sankey-query-v1`); the trail is not.
- **Toggles:** K applies to the cards and every sum; Avg/m is hidden (Per month is a card).
  The Sankey exclusions do **not** apply here: the criteria are explicit.
- The view pills and the sort stay on screen while scrolling a long list (sticky `.qbar`).
- **Phone:** the fields go two per row (16px text so iOS does not zoom on focus), the date
  pickers share the width, Count / Avg move under the name (`12 tx · avg -40 · WANTS`), and the
  transactions show `Detail · Account` under the label.
- Reconciled 10 Oct 2026 against a Python reference built straight from the sheet CSV:
  8.121 cash-flow transactions, sum 366.711; top expense month Nov 2025 (-5.764), top income
  month Nov 2024 (32.669).
- Code: pure `parseTx()`, `qTextMatcher()`, `qValueMatcher()`, `queryRows(tx, q)` (rows + the
  cascading suggestion lists, one pass with a bit per criterion), `queryGroup(rows, by)`,
  `querySort()`, `querySortTx()`, `txURL()`, `txOk()` (all in the test shim); `fetchTx()`,
  `refreshTx()`, `ensureTx()`, `TxCache`, then `q` state, `qInit()`, `syncQControls()`,
  `qDrill()`, `qBack()`, `renderQuery()`. Check: `_verify_query.py [shot]` (untracked).

### Years of Life Paid (net worth / T12M expenses)
A monthly line chart, the **Years Paid** page. Added 9 Oct 2026.
- **Metric:** `years = month-end net worth / expenses of the 12 months ending that
  month`, i.e. how many years the current net worth would pay at the last 12 months'
  spending. One point per month, from the first month with 12 months of cash-flow
  history (`META.minMi + 11`, Dec 2018) to the **last complete month**, so the last
  T12M expenses equal the Expenses card in the default T12M view (Sep 2026: 460.166 /
  52.960 = 8,7 years). Net worth is the same month-end series as the hero sparkline
  (running sum of every holding, earlier rows carried into the opening balance), so
  early points can be negative (Dec 2018: -2,8).
- **Now point:** when live prices are in (`LIVE`), one extra point at the end = live
  net worth (the hero value) / the T12M expenses of the last 12 complete months, drawn
  as a ring. Without live prices the line ends on the last complete month.
- **Expense flags:** the `Expenses` pill in the section header opens a checkbox list
  under the chart, one row per expense label with its T12M amount, grouped by macro
  group in Sankey `ORDER` (Needs, Wants, Liberality, Taxes) and Stable_Order inside a
  group. A group checkbox flags / unflags all its labels (indeterminate when mixed);
  `Select all` / `Select none` act on every label. A note on top shows `Counted X of Y
  · T12M <period>`, and the pill reads e.g. `Expenses 16/17` while some are off. Flags
  are kept in localStorage (`finance-sankey-ylp-off-v1`, the list of labels NOT
  counted), so they survive a reload. All labels count by default.
- **Exclusions:** an entry excluded from metrics in the Sankey (label or macro group)
  is out of this chart too; in the flag list it shows struck through and locked, and
  Select all / none leave it alone. "Include all" in the controls row brings it back.
- **Toggles:** window-independent (ignores the range bar, signature check like the
  other charts, so dragging does not rebuild it). K applies to the tooltip and the
  flag amounts; Avg/m changes nothing (the value is a ratio of years).
- **Display:** y axis in years (1 / 2 / 5 steps, `0y` line stronger), one x label per
  January, last value labelled at the right end (`8,7y`). Hover / tap snaps to the
  nearest month: a dot on each series and a tooltip with years paid, net worth and T12M
  expenses (+ per month), each with its colour swatch, plus "N expenses not counted"
  when flags are off. No legend.
- **Background series (added 10 Oct 2026):** behind the years line, shapes only (the
  values are in the tooltip, there is no second axis):
  - **Net worth** (blue `YLP_NW` area + thin line), on a € scale whose zero sits on the
    years zero line and sized so the whole series fits (`kNw` = the larger of max net
    worth / top of the axis and min net worth / bottom of the axis). Since years =
    net worth / expenses, both cross zero in the same month.
  - **T12M expenses** (orange `YLP_EX` thin line + very light area), on its own scale:
    the peak sits at `YLP_EXP_H` = half of the positive height, so the trend reads as a
    band under the other two. Both follow the expense flags and the Sankey exclusions,
    like the years line.
- **No red for negatives:** each series keeps its own colour below zero too (a red
  below-zero variant was tried on 10 Oct 2026 and reverted at Stefano's request). Drawn at the frame's
  real pixel width, redrawn on resize. Phone: the flag list is one column.
- Code: pure `ylpSeries(data, holds, minMi, lastMi, off, excluded)` (exported in the
  test shim) returns `[{mi, nw, exp, years}]`; `renderYlp()` draws the chart and the
  flag list; `NW_NOW` (set in `buildNetWorth()`) carries the live net worth.
  Check: `_verify_ylp.py` (untracked) compares every month against a Python
  reference computed straight from the sheet CSV, plus flags, groups, Select all /
  none, persistence, Sankey exclusions, K, tooltip, the live Now point, and the
  background series (one point per month, drawn behind the line, net worth on the same
  side of zero as the years line, expenses peak at half height, no red anywhere).

### Period Comparison (A vs B, what went up and down)
A diverging change chart in table form, the **Compare** page. Added Oct 2026.
- **Two periods**, each picked with a type + anchor select in the section header
  (`#cmpModeA` / `#cmpA` vs `#cmpModeB` / `#cmpB`):
  `T12M` = 12 months ending on the anchor month, `YTD` = January to the anchor month,
  `Year` = a calendar year (the current year runs to today), `Month` = the anchor month.
  Anchors run from the current month back to the start of the data (a T12M never starts
  before the first month). Nothing after the current month is counted.
- **Defaults:** A = T12M on the last complete month (Oct 2025 - Sep 2026 on 5 Oct 2026),
  B = the 12 months before it. Changing A's type resets both sides: B takes the same
  type, one year earlier (Month: the month before; Year: A = last complete year, B = the
  year before). Changing B's type re-defaults B against A; anchor picks stick.
- **Rows:** totals on top (Income, Expenses, Savings, Safe savings; the savings rows
  carry `A% vs B%` of income / of safe income as a sub-line), then the Sankey groups in
  `ORDER` (Work income, Non-work income, Needs, Wants, Liberality, Taxes, ...),
  **collapsed by default**. Tap a group for its labels, tap a label marked ▸ for its
  DETAIL sub-categories (only labels with more than one). Expand all / Collapse all
  above the table. Rows zero in both periods are hidden. Leaf names are shown as in the
  Sankey (upper case).
- **Columns:** change bar (right = went up, left = went down), Δ = A - B, % change vs B
  (`new` when B is zero, `>999%` above that), then the A and B values with a short period
  header (`Oct 25–Sep 26`, `Jan–Sep 26`, `2025`, `Sep 26`). **Colour = good or bad for
  savings**, not direction: income / savings up and spend down are green, the opposite
  red. Totals have their own bar scale; groups, labels and details share one.
- **Sort:** the `By Δ` pill (on by default) orders labels and details inside each group
  by the size of the change; off = Stable_Order (same as the Sankey).
- **Toggles:** independent of the range bar. `Avg/m` divides each period by **its own**
  month count (months with data), so periods of different length compare (headers then
  read `/m`); `K` applies. Exclusions: totals and group rows drop excluded entries,
  excluded rows stay listed but greyed, with an "N excluded" note above the table.
- **Phone:** the A / B columns move under the name as `A vs B`, the selects share the
  width, no sideways scroll.
- Code: pure `periodSums(data, detail, f, t)` and `comparePeriods(data, detail, pa, pb,
  excluded)` (both in the test shim), plus `cmpRange()`, `cmpAnchors()`,
  `cmpDefaultA/B()`, `syncCmpControls()` and `renderCompare()`. `renderCompare()` runs
  from every `build()` but only redraws when its inputs change (signature check), so
  dragging the range bar does not rebuild it.
- Reconciled 5 Oct 2026: A = 101.468 income / 52.960 expenses, equal to the T12M cards.

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
- **Month drill-down (added 5 Oct 2026):** click a year (touch: tap shows the
  tooltip, a second tap on the same year drills; keyboard: Enter) to see that year's
  months as the same bars, Jan..Dec in 12 fixed slots (missing months stay blank,
  the in-progress month is labelled `MTD`). Works in Overview and with any picker
  entry, honours exclusions and K; Avg/m changes nothing (a month is one month).
  The savings % lines become monthly rates: their scale stops at -100% so one bad
  month does not flatten the band, and the in-progress month gets no point (its
  rate is noise early in the month; the tooltip still shows it). A green
  `‹ YYYY` pill left of R12M (or Esc) goes back to the years; turning R12M on
  leaves the drill. The year tooltip ends with a muted "Click for months" hint.
  Code: `cfDrill` state; `cashFlowByYear()` and `cfSeriesByYear()` take a `bucket`
  that may return `null` to skip a row (`mi=> year(mi)===Y ? mi : null`).
  Check: `_verify_cfdrill.py` (untracked): months sum to the year (2024: 143.076 /
  36.891), back pill, touch double tap, Esc, R12M reset, series mode.
- **Month detail (added 10 Oct 2026):** in the month view, clicking a month (touch: a
  tap; keyboard: Enter) opens the **Month detail** overlay with that month's income and
  expenses in full. Independent of the picker and R12M (those stay year-level). It holds:
  - **Four cards** on top: Income, Expenses, Savings, Safe savings (same definitions and
    red-when-negative rule as the Cash Flow cards; the Savings sub-line is the % saved).
  - **A table** of every income group and expense group (Needs, Wants, Liberality, Taxes)
    with their labels, **biggest first**: value, a bar (one shared scale, the biggest
    non-excluded label is full width), and the **share of that month's income**. A label
    that has a `DETAIL` breakdown opens its sub-categories on tap (▸), shown as indented
    muted rows (same drill-down pattern as the net-worth table), biggest first with their
    own bar and share; a group header collapses its labels. Expenses are separated from
    income by a heavier rule. A label is drillable when its DETAIL breakdown **adds
    something**: `comparePeriods()` carries the details when the period has more than one
    distinct sub-category, OR a single one whose name differs from the label. So a lone
    DETAIL equal to the label (Groceries -> Groceries, Food, Restaurants, ...) is not
    drillable, but a single named one is (Holidays -> Weekend in Sep, -> Argentina-Jan27
    in Oct), which is why Holidays now expands every month, not only when there are two or
    more trips. `renderMd()` then shows the arrow for `l.details.length > 0`.
  - **Navigation:** `‹` / `›` (or the ← / → arrow keys) step month by month, clamped to
    the data; the chart behind follows the year. **`Cash Flow ›`** opens that month in the
    Cash Flow Sankey (sets Month mode + the range window, switches to the Cash Flow page).
    Closes with Close, Esc, a click outside (except on the Avg/m / K pills), or a page
    switch. The entry picked in the chart `select` is highlighted (gold); if it was a
    DETAIL, its label opens.
  - Honours exclusions (greyed rows, out of the totals, an "N excluded" note in the
    subtitle) and K; Avg/m does nothing (one month). Built from the pure
    `comparePeriods()` with the same month as both periods; `renderMd()` runs from every
    `build()` so a data refresh, an exclusion or a K toggle updates the open overlay.
  Code: `mdMi` state, `openMd()`, `renderMd()`, `mdGo()`, `openMonthInCashFlow()`,
  `closeMd()`, overlay `#mdetail`. Check: `_verify_mdetail.py` (untracked): cards vs a
  Python per-month reference, label/detail expand, group collapse, prev/next + arrows,
  K, exclusion, the Cash Flow jump, Esc and page-switch close.
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
    **Every label keeps its own layer**: small ones are no longer folded into an
    "Other (n)" layer (removed Oct 2026, `CF_ROLL_MAX` is gone); only layers that are
    zero over the whole axis are dropped. With one group, colours come from the
    12-colour palette, then golden-angle hues. Past 12 entries the tooltip lists the
    layers two per line so it stays on screen.
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

Every page stays hidden until the data has loaded, so no empty box shows next to the
skeleton (hero, table rows, controls, range, cards, Sankey).

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
  selection-adjusted income leaf links), and turns red when negative. **Savings** is
  always shown too (it used to disappear when savings were <= 0, e.g. in This M while
  expenses run ahead of income) and turns red when negative. The Needs / Wants / Liberality / Taxes sub-boxes were removed; those
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
  - **Toggles** `Avg/m | K` (on the other pages this same element sits in the
    section header, see Pages).
  The whole controls row is **sticky** (`position:sticky; top:var(--tabsh)`, i.e.
  under the desktop tab row, at the top on phones; page-coloured background, a soft
  shadow via `.stuck` once it floats), so This M / Last M / T12M and Avg/m / K stay
  on screen while scrolling through the Sankey. On phones `html,body` use `overflow-x:clip` (with `hidden` as a
  fallback): `hidden` turns body into a scroll container and silently kills sticky.
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
- **Draggable range bar** (always visible): a **fixed-width window that moves in
  discrete steps**, it never resizes. The width comes from the period mode: Month
  (This M / Last M) = 1 month, T12M = 12 months, Year = one calendar year, All time
  = everything (nothing to move). Dragging a handle or the band slides the window by
  whole months (Year: whole years, a drag shorter than ~6 months stays put), e.g. in
  T12M you step back through earlier 12-month windows, in Month mode through single
  months. Pressing the bare track jumps the window so it ends on the pressed month,
  then keeps dragging. Every move goes through the Year / Month anchor and
  `presetRange()` (`moveWindowTo()`), so the pickers, the T12M flag and the This M /
  Last M highlight always describe what is on screen. In T12M the anchor is clamped
  to at least the 12th month of data, so the window never shrinks at the start. The
  on-screen usage instructions under the bar were removed.
  - **Drag fix (landscape / touch):** `touch-action` is not inherited, so the
    handles and the middle band now set `touch-action:none` themselves — without it
    the browser claimed a horizontal drag as a pan gesture and the bar did not move.
    The drag also takes a **pointer capture** on the pressed element (so moves keep
    arriving once the finger leaves the 26px band), handles `pointercancel`, keeps
    the enlarged invisible grab area at **every** viewport width rather than only
    under 680px, and only falls back to the touch-event pipeline when
    `window.PointerEvent` is missing (running both pipelines let `touchstart`'s
    `preventDefault` cancel the in-flight pointer drag).
  - One `pointerdown` listener on the whole bar (`#dual`) handles handles, band and
    track alike, so the old 1-month "superposed handles" problem cannot occur. Moves
    that do not change the months skip the re-render, which keeps dragging smooth.
    To pick a custom start/end range, use the Quick set + Year / Month pickers.
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
- Runs in parallel with the DB load, then on the auto refresh schedule (see
  Performance / Auto refresh: every 5 minutes while visible). Any failure is silent and
  the DB values stay.
- Freshness is whatever Google last computed for `GOOGLEFINANCE` (usually up to
  ~20 min delayed). A LIST entry with no matching NETWORTH row (e.g. `DIRECTA|AMZN`,
  not yet in DB/NETWORTH) has no price and is ignored.
- Reconciled Oct 2026: app total vs `NETWORTH!F11` differed by ~1 € (rounding of
  DB rows). Since the slim query (sums of raw values, 9 Oct 2026) it matches to the
  euro (464.332 on both).

## Performance / loading

Reworked 9 Oct 2026, when opening had grown to ~0,45-0,85 s of blocked main thread on
every visit (4x CPU throttle, i.e. a phone) as the sheet and the page grew. Three
changes, measured on the same data (Chrome, 4x throttle, script time per open):
old 440-850 ms, now ~40 ms (Net Worth), ~120 ms (Cash Flow), ~175 ms (Savings).

1. **Slim query** (`slimURL()`): the DB tab is 23 columns x ~13K rows (2,4 MB CSV).
   The app asks gviz for the 11 columns it uses, grouped, with `sum(VALUE)` per group:
   ~6K rows, 0,57 MB (36 KB gzipped instead of 141 KB). Same results; sums now use the
   raw values instead of the rounded display values of the full export, so a few
   totals move by 1 € (net worth now equals the sheet). Columns are addressed by
   letter (`SLIM_DEFAULT`: A, B, H, I, J, K, L, N, P, R, T), so every answer is checked
   (`slimOk()`: every needed header present, VALUE last, plain numbers). If it fails
   (columns moved, error page) the full export is read instead, and `learnCols()`
   re-learns the letters from its header into `finance-sankey-cols-v1`, so the next
   load is slim again. Parse + aggregate: 224 ms -> 54 ms (desktop).
2. **Snapshot cache** (`SheetCache`, `finance-sankey-cache-v2`): stores the crunched
   data (`DATA`, `DETAIL`, `NWHOLD`, `META`, ~0,18 MB) plus a fingerprint of the CSV
   (`csvHash()` = length + FNV-1a). A returning visit installs the snapshot
   (`applySnapshot()`, ~12 ms incl. drawing the page) with no CSV parse and no
   `aggregate()`. The background refresh hashes the new CSV (~3 ms): same fingerprint
   = nothing redone (the snapshot is re-stamped at most twice a day), new fingerprint
   = `applyData()` + new snapshot. Snapshots up to **30 days** old are shown while the
   refresh runs. **Bump the key (v3) whenever `aggregate()` changes the shape or meaning
   of `DATA` / `DETAIL` / `NWHOLD` / `META`**, otherwise a returning visit would paint
   the old shape until the CSV itself changes. The old v1 cache kept the raw CSV (~3M characters, ~6 MB as stored,
   over Safari's 5 MB localStorage quota) and is deleted on boot. Nothing is stored
   server-side and nothing is sent anywhere except the existing public sheet endpoint,
   so the privacy model is unchanged.
3. **One page per block, drawn lazily** (see Pages): boot draws only the page on
   screen, the range bar redraws only the Sankey, and layout reads of hidden charts
   are gone.

- A small **"Showing last loaded data" badge** appears while refreshing and if the
  refresh fails (the cached view stays on screen).

### Auto refresh (added 10 Oct 2026)
The page keeps itself current without a reload, only while the tab is visible:

| What | Every | On return to the tab / window, back online, back-forward cache |
|---|---|---|
| DB sheet (slim query) | 10 min (`DB_EVERY`) | at once if the last check is older than 2 min (`DB_STALE`) |
| Live ETF values + investment gains | 5 min (`LIVE_EVERY`) | at once if older than 1 min (`LIVE_STALE`) |
| Query transactions (only while the Query page is on screen) | 10 min | at once if older than 2 min, or when the DB fingerprint changed |

- One 30 s ticker (`autoTick()`) decides what is due, so a laptop waking from sleep
  catches up on the first tick. A hidden tab fetches nothing.
- **Silent:** `refreshDB()` hashes the answer; same fingerprint = nothing redrawn,
  new fingerprint = `applyData()` + a new snapshot. The open page, the range-bar window,
  exclusions, Avg/m / K, the Compare picks, open rows and the Years Paid flags all stay.
  A failed check keeps what is on screen; the next tick retries.
- Never redraws under a range-bar drag: a new answer waits until the drag ends.
- Why these intervals: the sheet changes when Stefano books something (a few times a
  day), and `GOOGLEFINANCE` itself only updates about every 20 min, so faster polling
  would only add requests. Each DB check is ~36 KB gzipped.
- The live fetch **retries up to 3 times** with a **10s timeout per attempt**, and a
  **30s overall guard** shows a timeout error if a cold load never returns. On a cold
  failure with any cached copy present (even stale), the cached copy is shown instead
  of an error.
- A **skeleton placeholder** (CSS-only shimmer mirroring the controls, cards,
  Sankey and table) is in the initial markup, so it paints immediately with no JS
  and is hidden the moment real content renders (no blank/unstyled gap). It
  respects `prefers-reduced-motion`.
- If `localStorage` is unavailable (private mode, disabled), the app silently falls
  back to a plain live fetch.
- Why not separate HTML files per page: every file would still have to download and
  crunch the same sheet on each switch (a full reload), while the HTML itself is
  ~60 KB gzipped and already HTTP-cached by GitHub Pages. In-page pages switch with no
  reload and share one loaded dataset.

The file remains a single self-contained HTML page with no build step and no
external dependencies.

## Data source requirements
The Google Sheet must be shared as **“Anyone with the link → Viewer”** and have a
tab named **`DB`**. Columns used (extra columns are ignored):
`YEAR, MONTH, VALUE, LABEL, DETAIL, ASSETCLASSDETAILS, TYPE, CATEGORY1` for the
cash-flow Sankey, plus `ACCOUNT, VARIABLE, CATEGORY3` for the net-worth table.
They are read by letter through the slim query (see Performance); if a column is
inserted or moved, the first load after it falls back to the full export and
re-learns the letters by header name, so nothing needs editing.

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
`scaleReferenceFor`; the shim also exports `slimURL`, `learnCols`, `slimOk`, `csvHash`,
the Oct 2026 chart helpers and the Query helpers `txURL`, `txOk`, `parseTx`,
`qTextMatcher`, `qValueMatcher`, `queryRows`, `queryGroup`, `querySort`, `querySortTx`). Note: `data-path-smoke` still expects the v1 raw-CSV
cache and a single fetch URL, so it predates the snapshot cache. It is **never referenced by `index.html`** — the page stays a
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
