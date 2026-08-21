# Personal Finance — Sankey

A single, self-contained web page that renders a money-flow **Sankey diagram**,
a **trend chart**, and a **net-worth table** from a Google Sheet. No build step,
no dependencies, no data stored in this repo — it reads the sheet live in the
browser.

**Live:** https://stefanoamato93-wq.github.io/finance-sankey/

## What it shows

### Sankey (money flow)
`income sources → Work / Non-work income → Budget → Needs / Wants / Liberality /
Taxes / Savings → category`. Savings is the residual (income − expenses − taxes).
- Percentages appear at **every level**: group nodes, and the income-source and
  expense-category leaves (each as a share of income).
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
  selected window (a partial current year divides by the elapsed months).
- **Values in K** toggle.

### Trend chart
Line chart over time with three selectors:
- **Level:** Overview (Income / Expenses / Savings), Macro groups (Needs / Wants /
  Liberality / Taxes / Savings), Categories (expense labels), or Details (top 12
  detail lines + Other).
- **Value:** Absolute or **% of income**.
- **Granularity:** Monthly or Yearly.
The currently selected period is shaded; hover for a per-period readout.

### Net-worth table
Cumulative of **every** transaction (includes appreciation, transfers and
liabilities — not just cash flow), bucketed by asset type
(Cash / Investments / Real estate / Goods / Liabilities), shown at each year end
with a total and year-over-year change.

## Data source requirements
The Google Sheet must be shared as **“Anyone with the link → Viewer”** and have a
tab named **`DB`** with these columns (extra columns are ignored):
`YEAR, MONTH, VALUE, LABEL, DETAIL, ASSETCLASSDETAILS, TYPE, CATEGORY1`.

Row handling:
- `TYPE=INCOME` → source = `DETAIL`, grouped by `CATEGORY1`
  (`WORKINCOME` / `NONWORKINCOME`).
- `TYPE=EXPENSES` → category = `LABEL`, grouped by `CATEGORY1`
  (`NEEDS` / `WANTS` / `LIBERALITY`).
- `TYPE=TAXES` → grouped as `Taxes`; `DETAIL=ApprecTaxes` is excluded from cash
  flow (it pairs with the excluded appreciation).
- `TYPE=TRANSFER` / `TYPE=APPRECIATION` are excluded from the cash-flow Sankey
  and trend, but **all rows** (every type) count toward the net-worth table.
- Net-worth buckets come from `ASSETCLASSDETAILS` via a fixed map in `index.html`
  (`NWBUCKET`); unmapped classes fall into `Other`.

## Privacy
The page is public and reads a public sheet, so anyone with the page URL (or the
sheet's CSV URL) can see the figures. Keep only data you are comfortable exposing.

## Configuration
Change `SHEET_ID` / `SHEET_NAME` at the top of the `<script>` block, and the
`NWBUCKET` map to re-bucket asset classes for the net-worth table.

## Local variant
The sibling folder `Personal Finance/` also has an offline builder
(`build_sankey.py` → `sankey.html`) that embeds a snapshot of `FullDB.xlsx`
instead of reading the live sheet.
