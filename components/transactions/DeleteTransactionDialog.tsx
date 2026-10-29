"use client";

import { useId, useState, useTransition } from "react";
import Dialog from "@mui/material/Dialog";
import { deleteTransactionAction } from "@/actions/transactions";
import Button from "@/components/ui/Button";
import FormAlert from "@/components/ui/FormAlert";
import { formatCurrency } from "@/lib/format";
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";
import type { TransactionRow } from "./transaction-row";

// The caller owns `open`, and keeps passing the same transaction while the dialog fades out
export default function DeleteTransactionDialog({
  open,
  onClose,
  transaction,
}: {
  open: boolean;
  onClose: () => void;
  transaction?: TransactionRow;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { markStale, refreshIfStale } = useRefreshWhenStale();
  const titleId = useId();

  function close() {
    onClose();
    setError(null);
    refreshIfStale();
  }

  function confirmDelete() {
    if (!transaction) return;

    startTransition(async () => {
      const result = await deleteTransactionAction(transaction.id);

      if (result.ok) {
        close();
      } else {
        markStale();
        setError("This transaction no longer exists. It may have been deleted in another tab.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={pending ? undefined : close}
      fullWidth
      maxWidth="xs"
      aria-labelledby={titleId}
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="text-lg font-semibold">
          Delete transaction?
        </h2>
        {transaction && (
          <p className="text-sm text-neutral-300">
            “{transaction.description}” (
            {formatCurrency(transaction.amount, transaction.currency)} on{" "}
            {transaction.date}) will be removed for good.
          </p>
        )}
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
  );
}
