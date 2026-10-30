"use client";
// ---React---
import { useId, useState } from "react";

// ---MUI---
import Dialog from "@mui/material/Dialog";

// ---Components---
import DepositDialogForm from "./DepositDialogForm";

// ---UI Components---
import Button from "@/components/ui/Button";

// ---Lib---
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";

// ---Types---
import type { SavingsDeposit, SavingsGoal } from "@/types/finance";

// Adds money to the goal, or takes some out. Changes the given deposit when there is one.
export default function DepositDialog({
  goal,
  deposit,
}: {
  goal: Pick<SavingsGoal, "id" | "name" | "currency">;
  deposit?: SavingsDeposit;
}) {
  const [open, setOpen] = useState(false);
  const { markStale, refreshIfStale } = useRefreshWhenStale();
  const titleId = useId();

  const close = () => {
    setOpen(false);
    refreshIfStale();
  };

  return (
    <>
      {deposit ? (
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs"
          aria-label={`Edit entry of ${deposit.date} in ${goal.name}`}
          onClick={() => setOpen(true)}
        >
          Edit
        </Button>
      ) : (
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300"
          aria-label={`Add or withdraw money for ${goal.name}`}
          onClick={() => setOpen(true)}
        >
          Add / withdraw
        </Button>
      )}
      <Dialog
        open={open}
        onClose={close}
        fullWidth
        maxWidth="xs"
        aria-labelledby={titleId}
      >
        {/* Only mounted while open, so every opening starts with a fresh form */}
        <DepositDialogForm
          goal={goal}
          deposit={deposit}
          titleId={titleId}
          onClose={close}
          onStale={markStale}
        />
      </Dialog>
    </>
  );
}
