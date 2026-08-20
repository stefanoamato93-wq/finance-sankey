# Personal Finance — Sankey

A self-contained web page that renders a money-flow Sankey diagram from a Google Sheet.

**Live:** published via GitHub Pages (see the repo's Pages URL).

## How it works
- On load, the page fetches the sheet tab **`DB`** as CSV from Google Sheets
  (`gviz/tq?tqx=out:csv&sheet=DB`) and aggregates it in the browser. No data is
  stored in this repository.
- Flow: income sources (work / non-work) → Budget → Needs / Wants / Liberality /
  Taxes / Savings → category. Savings is the residual (income − expenses − taxes).
- **Filters:** All time / Full year / Single month / Trailing 12 months, plus a
  **per-month average** toggle and a values-in-K toggle.
- **Percentages** on each group node are the share of income.
- **Hover an expense category** to open a small floating Sankey of its detail
  breakdown (from the DB `DETAIL` column).

## Requirements for the data source
The Google Sheet must be shared as **“Anyone with the link → Viewer”** and have a
tab named **`DB`** with columns: `YEAR, MONTH, VALUE, LABEL, DETAIL, TYPE,
CATEGORY1` (extra columns are ignored).

Row rules mirror the local builder:
- `TYPE=INCOME` → source = `DETAIL`, grouped by `CATEGORY1`
  (`WORKINCOME` / `NONWORKINCOME`).
- `TYPE=EXPENSES` → category = `LABEL`, grouped by `CATEGORY1`
  (`NEEDS` / `WANTS` / `LIBERALITY`).
- `TYPE=TAXES` → grouped as `Taxes`, but `DETAIL=ApprecTaxes` is excluded.
- `TYPE=TRANSFER` and `TYPE=APPRECIATION` are ignored (not cash flow).

## Privacy
The page is public and reads a public sheet, so anyone with the page URL can see
the figures. Keep only data you are comfortable exposing, or restrict access
another way.

## Change the data source
Edit `SHEET_ID` and `SHEET_NAME` at the top of the `<script>` block in
`index.html`.
