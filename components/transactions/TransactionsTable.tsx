"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import Button from "@/components/ui/Button";
import FormField, { inputClass } from "@/components/ui/FormField";
import SelectField from "@/components/ui/SelectField";
import { formatCurrency } from "@/lib/format";
import { transactionTypeLabels } from "@/lib/labels";
import type { Category, TransactionType } from "@/types/finance";
import DeleteTransactionDialog from "./DeleteTransactionDialog";
import TransactionFormDialog from "./TransactionFormDialog";
import type { TransactionRow } from "./transaction-row";

// `row` stays set while a dialog fades out, so its content doesn't change under the user
type DialogState = { open: boolean; row?: TransactionRow };
const closed: DialogState = { open: false };

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
  const [form, setForm] = useState<DialogState>(closed);
  const [removal, setRemoval] = useState<DialogState>(closed);
  const typeLabelId = useId();
  const categoryLabelId = useId();

  const columns = useMemo<GridColDef<TransactionRow>[]>(
    () => [
      { field: "date", headerName: "Date", width: 130 },
      { field: "description", headerName: "Description", flex: 1, minWidth: 180 },
      { field: "categoryName", headerName: "Category", width: 160 },
      {
        field: "type",
        headerName: "Type",
        width: 110,
        renderCell: ({ value }) => (
          <span className={value === "INCOME" ? "text-emerald-400" : "text-red-400"}>
            {transactionTypeLabels[value as TransactionType]}
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
      {
        field: "actions",
        headerName: "",
        width: 140,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: ({ row }) => (
          <div className="flex h-full items-center gap-1 leading-normal">
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs"
              aria-label={`Edit ${row.description} from ${row.date}`}
              onClick={() => setForm({ open: true, row })}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
              aria-label={`Delete ${row.description} from ${row.date}`}
              onClick={() => setRemoval({ open: true, row })}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

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

  const hasCategories = categories.length > 0;

  return (
    <div>
      {!hasCategories && (
        <p className="mb-4 rounded-xl border border-dashed border-white/15 p-4 text-sm text-neutral-400">
          Every transaction needs a category.{" "}
          <Link href="/categories" className="text-emerald-400 hover:underline">
            Create your first category
          </Link>{" "}
          to start adding transactions.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
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
          <FormField label="Type" labelId={typeLabelId}>
            <SelectField
              labelId={typeLabelId}
              value={type}
              onChange={(v) => setType(v as "all" | TransactionType)}
              options={[
                { value: "all", label: "All" },
                { value: "INCOME", label: transactionTypeLabels.INCOME },
                { value: "EXPENSE", label: transactionTypeLabels.EXPENSE },
              ]}
            />
          </FormField>
        </div>
        <div className="w-48">
          <FormField label="Category" labelId={categoryLabelId}>
            <SelectField
              labelId={categoryLabelId}
              value={categoryId}
              onChange={setCategoryId}
              options={[
                { value: "all", label: "All" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </FormField>
        </div>
        <Button
          className="ml-auto"
          disabled={!hasCategories}
          onClick={() => setForm({ open: true })}
        >
          Add transaction
        </Button>
      </div>

      <DataGrid
        rows={filteredRows}
        columns={columns}
        disableRowSelectionOnClick
        pageSizeOptions={[10, 25]}
        localeText={{ noRowsLabel: "No transactions to show" }}
        initialState={{
          pagination: { paginationModel: { pageSize: 10 } },
          sorting: { sortModel: [{ field: "date", sort: "desc" }] },
        }}
      />

      <TransactionFormDialog
        open={form.open}
        transaction={form.row}
        categories={categories}
        onClose={() => setForm((current) => ({ ...current, open: false }))}
      />
      <DeleteTransactionDialog
        open={removal.open}
        transaction={removal.row}
        onClose={() => setRemoval((current) => ({ ...current, open: false }))}
      />
    </div>
  );
}
