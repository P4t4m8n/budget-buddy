"use client";
// ---React---
import { useId, useState } from "react";

// ---MUI---
import Dialog from "@mui/material/Dialog";

// ---Components---
import BudgetDialogForm from "./BudgetDialogForm";

// ---UI Components---
import Button from "@/components/ui/Button";

// ---Lib---
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";

// ---Types---
import type { BudgetRow } from "@/types/budget";

// Sets the category's budget for the month: "Set budget" when it has none, "Edit" otherwise
export default function BudgetDialog({
  row,
  month,
}: {
  row: BudgetRow;
  month: string;
}) {
  const [open, setOpen] = useState(false);
  const { markStale, refreshIfStale } = useRefreshWhenStale();
  const titleId = useId();

  const close = () => {
    setOpen(false);
    refreshIfStale();
  };

  const hasBudget = row.budgetId !== null;

  return (
    <>
      <Button
        variant="ghost"
        className="px-2 py-1 text-xs"
        aria-label={`${hasBudget ? "Edit" : "Set"} budget for ${row.name}`}
        onClick={() => setOpen(true)}
      >
        {hasBudget ? "Edit" : "Set budget"}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        fullWidth
        maxWidth="xs"
        aria-labelledby={titleId}
      >
        {/* Only mounted while open, so every opening starts with a fresh form */}
        <BudgetDialogForm
          row={row}
          month={month}
          titleId={titleId}
          onClose={close}
          onStale={markStale}
        />
      </Dialog>
    </>
  );
}
