"use client";

import { useMemo, useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { formatCurrency } from "@/lib/format";
import type { Category, TransactionType } from "@/types/finance";

export type TransactionRow = {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  categoryName: string;
  date: string;
};

const columns: GridColDef<TransactionRow>[] = [
  { field: "date", headerName: "Date", width: 130 },
  { field: "description", headerName: "Description", flex: 1, minWidth: 180 },
  { field: "categoryName", headerName: "Category", width: 160 },
  {
    field: "type",
    headerName: "Type",
    width: 110,
    renderCell: ({ value }) => (
      <span
        className={value === "income" ? "text-emerald-400" : "text-red-400"}
      >
        {value}
      </span>
    ),
  },
  {
    field: "amount",
    headerName: "Amount",
    type: "number",
    width: 130,
    valueFormatter: (value: number) => formatCurrency(value),
  },
];

export default function TransactionsTable({
  rows,
  categories,
}: {
  rows: TransactionRow[];
  categories: Category[];
}) {
  const [type, setType] = useState<"all" | TransactionType>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (type === "all" || row.type === type) &&
          (categoryId === "all" || row.categoryId === categoryId) &&
          row.description.toLowerCase().includes(search.toLowerCase()),
      ),
    [rows, type, categoryId, search],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <TextField
          size="small"
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <TextField
          select
          size="small"
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value as "all" | TransactionType)}
          className="w-40"
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="income">Income</MenuItem>
          <MenuItem value="expense">Expense</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-48"
        >
          <MenuItem value="all">All</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
      </div>

      <DataGrid
        rows={filteredRows}
        columns={columns}
        disableRowSelectionOnClick
        pageSizeOptions={[10, 25]}
        initialState={{
          pagination: { paginationModel: { pageSize: 10 } },
          sorting: { sortModel: [{ field: "date", sort: "desc" }] },
        }}
      />
    </div>
  );
}
