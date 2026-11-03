"use client";

import { useId, useState, useTransition } from "react";
import Dialog from "@mui/material/Dialog";
import { deleteInvestmentAction } from "@/actions/investments";
import Button from "@/components/ui/Button";
import FormAlert from "@/components/ui/FormAlert";
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";
import type { InvestmentRow } from "@/types/investments";

// The caller owns `open`, and keeps passing the same investment while the dialog fades out
export default function DeleteInvestmentDialog({
  open,
  onClose,
  investment,
}: {
  open: boolean;
  onClose: () => void;
  investment?: InvestmentRow;
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
    if (!investment) return;

    startTransition(async () => {
      const result = await deleteInvestmentAction(investment.id);

      if (result.ok) {
        close();
      } else {
        // The list is out of date: refresh it once the message has been read
        if (result.error.code === "NOT_FOUND") markStale();
        setError(result.error.message);
      }
    });
  }

  const recorded = investment?.snapshotCount ?? 0;

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
          Delete investment?
        </h2>
        {investment && (
          <p className="text-sm text-neutral-300">
            “{investment.name}” will be removed
            {recorded > 0 &&
              `, together with its ${recorded} recorded ${recorded === 1 ? "value" : "values"}`}
            . This can&apos;t be undone.
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
