"use client";
// ---React---
import { useId, useState } from "react";

// ---MUI---
import Dialog from "@mui/material/Dialog";

// ---Components---
import GoalDialogForm from "./GoalDialogForm";

// ---UI Components---
import Button from "@/components/ui/Button";

// ---Lib---
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";

// ---Types---
import type { SavingsGoal } from "@/types/finance";

// Add when no goal is passed, edit otherwise
export default function GoalDialog({ goal }: { goal?: SavingsGoal }) {
  const [open, setOpen] = useState(false);
  const { markStale, refreshIfStale } = useRefreshWhenStale();
  const titleId = useId();

  const close = () => {
    setOpen(false);
    refreshIfStale();
  };

  return (
    <>
      {goal ? (
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs"
          aria-label={`Edit goal ${goal.name}`}
          onClick={() => setOpen(true)}
        >
          Edit
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>Add goal</Button>
      )}
      <Dialog
        open={open}
        onClose={close}
        fullWidth
        maxWidth="xs"
        aria-labelledby={titleId}
      >
        {/* Only mounted while open, so every opening starts with a fresh form */}
        <GoalDialogForm
          goal={goal}
          titleId={titleId}
          onClose={close}
          onStale={markStale}
        />
      </Dialog>
    </>
  );
}
