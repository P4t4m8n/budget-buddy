"use client";
// ---React---
import { useId, useState, useTransition } from "react";

// ---MUI---
import Dialog from "@mui/material/Dialog";

// ---Actions---
import { deleteBudgetAction } from "@/actions/budgets";

// ---UI Components---
import Button from "@/components/ui/Button";
import FormAlert from "@/components/ui/FormAlert";

// ---Lib---
import { formatCurrency, formatMonth } from "@/lib/format";
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";

// ---Types---
import type { BudgetRow } from "@/types/budget";

// Only for categories that have a budget; removing it doesn't touch any transactions
export default function DeleteBudgetButton({
  row,
  month,
}: {
  row: BudgetRow;
  month: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { markStale, refreshIfStale } = useRefreshWhenStale();
  const titleId = useId();

  const close = () => {
    setOpen(false);
    setError(null);
    refreshIfStale();
  };

  const confirmDelete = () => {
    if (row.budgetId === null) return;
    const budgetId = row.budgetId;

    startTransition(async () => {
      const result = await deleteBudgetAction(budgetId);

      if (result.ok) {
        close();
      } else {
        // The list is out of date: refresh it once the message has been read
        if (result.error.code === "NOT_FOUND") markStale();
        setError(result.error.message);
      }
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
        aria-label={`Remove budget for ${row.name}`}
        onClick={() => setOpen(true)}
      >
        Remove
      </Button>
      <Dialog
        open={open}
        onClose={pending ? undefined : close}
        fullWidth
        maxWidth="xs"
        aria-labelledby={titleId}
      >
        <div className="flex flex-col gap-4 p-6">
          <h2 id={titleId} className="text-lg font-semibold">
            Remove budget?
          </h2>
          <p className="text-sm text-neutral-300">
            The {row.limit !== null && formatCurrency(row.limit, row.currency)}{" "}
            budget for “{row.name}” in {formatMonth(month)} will be removed.
            Your transactions are not affected.
          </p>
          {error && <FormAlert>{error}</FormAlert>}
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={pending}>
              {pending ? "Removing…" : "Remove"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
