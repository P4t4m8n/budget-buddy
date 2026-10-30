"use client";
// ---React---
import { useId, useState, useTransition } from "react";

// ---MUI---
import Dialog from "@mui/material/Dialog";

// ---Actions---
import { deleteGoalAction } from "@/actions/savings";

// ---UI Components---
import Button from "@/components/ui/Button";
import FormAlert from "@/components/ui/FormAlert";

// ---Lib---
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";

// ---Types---
import type { SavingsGoal } from "@/types/finance";

export default function DeleteGoalButton({ goal }: { goal: SavingsGoal }) {
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
      const result = await deleteGoalAction(goal.id);

      if (result.ok) {
        close();
      } else if (result.error.code === "IN_USE") {
        const { deposits = 0 } = result.error.details ?? {};
        setError(
          `“${goal.name}” still has ${deposits} ${deposits === 1 ? "deposit" : "deposits"}. Delete ${deposits === 1 ? "it" : "them"} first.`,
        );
        // The card is out of date: it didn't know about every deposit
        markStale();
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
        aria-label={`Delete goal ${goal.name}`}
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
            Delete goal?
          </h2>
          <p className="text-sm text-neutral-300">
            “{goal.name}” will be removed. A goal that still has deposits can&apos;t
            be deleted: delete its deposits first.
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
