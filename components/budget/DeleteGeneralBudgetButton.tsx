"use client";
// ---React---
import { useId, useState, useTransition } from "react";

// ---MUI---
import Dialog from "@mui/material/Dialog";

// ---Actions---
import { deleteGeneralBudgetAction } from "@/actions/budgets";

// ---UI Components---
import Button from "@/components/ui/Button";
import FormAlert from "@/components/ui/FormAlert";

// ---Lib---
import { formatCurrency, formatMonth } from "@/lib/format";
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";

// ---Types---
import type { GeneralBudget } from "@/types/budget";

// Removing the monthly budget doesn't touch the category budgets or any transactions
export default function DeleteGeneralBudgetButton({
  general,
  month,
}: {
  general: GeneralBudget;
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
    startTransition(async () => {
      const result = await deleteGeneralBudgetAction(general.budgetId);

      if (result.ok) {
        close();
      } else {
        // The page is out of date: refresh it once the message has been read
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
        aria-label="Remove monthly budget"
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
            Remove monthly budget?
          </h2>
          <p className="text-sm text-neutral-300">
            The <bdi dir="ltr">{formatCurrency(general.limit, general.currency)}</bdi>{" "}
            monthly budget for {formatMonth(month)} will be removed. Your category
            budgets and transactions are not affected.
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
