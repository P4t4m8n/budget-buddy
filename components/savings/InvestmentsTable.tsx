"use client";

import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { formatCurrency } from "@/lib/format";
import type { Currency, InvestmentType } from "@/types/finance";

export type InvestmentRow = {
  id: string;
  name: string;
  type: InvestmentType;
  ticker: string;
  amountInvested: number;
  currentValue: number;
  currency: Currency;
  gainPercent: number;
};

const money = (value: number, row: InvestmentRow) =>
  formatCurrency(value, row.currency);

const columns: GridColDef<InvestmentRow>[] = [
  { field: "name", headerName: "Name", flex: 1, minWidth: 180 },
  { field: "ticker", headerName: "Ticker", width: 100 },
  { field: "type", headerName: "Type", width: 100 },
  {
    field: "amountInvested",
    headerName: "Invested",
    type: "number",
    width: 130,
    valueFormatter: money,
  },
  {
    field: "currentValue",
    headerName: "Current value",
    type: "number",
    width: 150,
    valueFormatter: money,
  },
  {
    field: "gainPercent",
    headerName: "Return",
    type: "number",
    width: 110,
    renderCell: ({ value }) => (
      <span className={value >= 0 ? "text-emerald-400" : "text-red-400"}>
        {value >= 0 ? "+" : ""}
        {value.toFixed(1)}%
      </span>
    ),
  },
];

export default function InvestmentsTable({ rows }: { rows: InvestmentRow[] }) {
  return (
    <DataGrid
      rows={rows}
      columns={columns}
      disableRowSelectionOnClick
      hideFooter
    />
  );
}
