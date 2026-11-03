"use client";

import { useMemo, useState } from "react";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import Button from "@/components/ui/Button";
import { formatCurrency } from "@/lib/format";
import { investmentTypeLabels } from "@/lib/labels";
import type { InvestmentType } from "@/types/finance";
import type { InvestmentRow } from "@/types/investments";
import DeleteInvestmentDialog from "./DeleteInvestmentDialog";
import InvestmentFormDialog from "./InvestmentFormDialog";
import UpdateValueDialog from "./UpdateValueDialog";

// `row` stays set while a dialog fades out, so its content doesn't change under the user
type DialogState = { open: boolean; row?: InvestmentRow };
const closed: DialogState = { open: false };

const money = (value: number, row: InvestmentRow) =>
  formatCurrency(value, row.currency);

export default function InvestmentsTable({ rows }: { rows: InvestmentRow[] }) {
  const [form, setForm] = useState<DialogState>(closed);
  const [valueUpdate, setValueUpdate] = useState<DialogState>(closed);
  const [removal, setRemoval] = useState<DialogState>(closed);

  const columns = useMemo<GridColDef<InvestmentRow>[]>(
    () => [
      { field: "name", headerName: "Name", flex: 1, minWidth: 140 },
      {
        field: "ticker",
        headerName: "Ticker",
        width: 80,
        valueFormatter: (value: string | null) => value ?? "-",
      },
      {
        field: "type",
        headerName: "Type",
        width: 90,
        valueFormatter: (value: InvestmentType) => investmentTypeLabels[value],
      },
      {
        field: "amountInvested",
        headerName: "Invested",
        type: "number",
        width: 120,
        valueFormatter: money,
      },
      {
        field: "currentValue",
        headerName: "Current value",
        type: "number",
        width: 130,
        valueFormatter: money,
      },
      {
        field: "gainPercent",
        headerName: "Return",
        type: "number",
        width: 90,
        renderCell: ({ value }) => (
          <span className={value >= 0 ? "text-emerald-400" : "text-red-400"}>
            {value >= 0 ? "+" : ""}
            {value.toFixed(1)}%
          </span>
        ),
      },
      {
        field: "actions",
        headerName: "",
        width: 260,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: ({ row }) => (
          <div className="flex h-full items-center gap-1 leading-normal">
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300"
              aria-label={`Update value of ${row.name}`}
              onClick={() => setValueUpdate({ open: true, row })}
            >
              Update value
            </Button>
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs"
              aria-label={`Edit ${row.name}`}
              onClick={() => setForm({ open: true, row })}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
              aria-label={`Delete ${row.name}`}
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

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setForm({ open: true })}>Add investment</Button>
      </div>

      <DataGrid
        rows={rows}
        columns={columns}
        disableRowSelectionOnClick
        hideFooter
        autoHeight
        localeText={{ noRowsLabel: "No investments yet" }}
      />

      <InvestmentFormDialog
        open={form.open}
        investment={form.row}
        onClose={() => setForm((current) => ({ ...current, open: false }))}
      />
      <UpdateValueDialog
        open={valueUpdate.open}
        investment={valueUpdate.row}
        onClose={() =>
          setValueUpdate((current) => ({ ...current, open: false }))
        }
      />
      <DeleteInvestmentDialog
        open={removal.open}
        investment={removal.row}
        onClose={() => setRemoval((current) => ({ ...current, open: false }))}
      />
    </div>
  );
}
