"use client";

import { useMemo, useState } from "react";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import FormField, { inputClass } from "@/components/ui/FormField";
import SelectField from "@/components/ui/SelectField";
import { formatCurrency } from "@/lib/format";
import type { Category, Currency, TransactionType } from "@/types/finance";

export type TransactionRow = {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
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
    valueFormatter: (value: number, row) => formatCurrency(value, row.currency),
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
        <div className="w-56">
          <FormField label="Search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Description"
              className={inputClass}
            />
          </FormField>
        </div>
        <div className="w-40">
          <FormField label="Type">
            <SelectField
              value={type}
              onChange={(v) => setType(v as "all" | TransactionType)}
              options={[
                { value: "all", label: "All" },
                { value: "income", label: "Income" },
                { value: "expense", label: "Expense" },
              ]}
            />
          </FormField>
        </div>
        <div className="w-48">
          <FormField label="Category">
            <SelectField
              value={categoryId}
              onChange={setCategoryId}
              options={[
                { value: "all", label: "All" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </FormField>
        </div>
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
