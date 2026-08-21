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
- Totals cards on top: **Income, Expenses**, then Needs / Wants / Liberality /
  Taxes / Savings, each with its % of income.

### Period selection
- **Quick set** dropdown: Trailing 12 months / Single month / Full year / All time
  (anchored by the Year and Month pickers).
- **Draggable range bar** (always visible): drag either end to resize the window,
  or drag the **middle band to shift the whole period** (e.g. slide a trailing-12
  window across the years and watch the numbers update live).
- **Per month (avg)** toggle divides every value by the number of months in the
  selected window (a partial current year divides by the elapsed months). It also
  switches the true-scale reference to a single-month basis.
- **Values in K** toggle (applies to the Sankey and the net-worth table).

### Net-worth table
One row per **holding**, keyed by `VARIABLE` (variability) × `ASSETCLASSDETAILS`
× `ACCOUNT` × `CATEGORY3`, showing the **current balance** (cumulative of *every*
transaction — includes appreciation, transfers and liabilities, not just cash
flow) plus three deltas:
- **Δ Month** — vs the previous month.
- **Δ Year** — vs 12 months ago.
- **Δ Overall** — **return on invested capital**: current value vs the total
  capital ever transferred into the investing account (baseline = sum of
  `TYPE=TRANSFER` inflows on `VARIABLE` holdings). Absolute = value − transfers in,
  % = gain / transfers in. Shown **only for investment holdings**; blank for cash,
  real estate, objects and liabilities (which receive no investing transfers). The
  grand-total Overall therefore compares total net worth against total invested
  capital.

Rows are grouped by variability (`Variable` / `Nonvariable`) with a subtotal per
group and a grand-total **Net worth** row. Liabilities show as negative values in
parentheses; positive deltas are green, negative red, each with its % change.

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
