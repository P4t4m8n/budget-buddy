"use client";
// ---React---
import { useId, useState, useTransition } from "react";

// ---MUI---
import Dialog from "@mui/material/Dialog";

// ---Actions---
import { deleteDepositAction } from "@/actions/savings";

// ---UI Components---
import Button from "@/components/ui/Button";
import FormAlert from "@/components/ui/FormAlert";

// ---Lib---
import { formatCurrency } from "@/lib/format";
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";

// ---Types---
import type { SavingsDeposit, SavingsGoal } from "@/types/finance";

export default function DeleteDepositButton({
  goal,
  deposit,
}: {
  goal: Pick<SavingsGoal, "name" | "currency">;
  deposit: SavingsDeposit;
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
      const result = await deleteDepositAction(deposit.id);

      if (result.ok) {
        close();
      } else {
        // The list is out of date: refresh it once the message has been read
        if (result.error.code === "NOT_FOUND") markStale();
        setError(result.error.message);
      }
    });
  };

  const verb = deposit.amount < 0 ? "withdrawal" : "deposit";

  return (
    <>
      <Button
        variant="ghost"
        className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
        aria-label={`Delete entry of ${deposit.date} in ${goal.name}`}
        onClick={() => setOpen(true)}
      >
        Delete
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
            Delete {verb}?
          </h2>
          <p className="text-sm text-neutral-300">
            The {verb} of{" "}
            <bdi dir="ltr">
              {formatCurrency(Math.abs(deposit.amount), goal.currency)}
            </bdi>{" "}
            on {deposit.date} will be removed from “{goal.name}”.
          </p>
          {error && <FormAlert>{error}</FormAlert>}
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
