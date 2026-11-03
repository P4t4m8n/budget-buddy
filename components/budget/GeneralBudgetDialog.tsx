"use client";
// ---React---
import { useId, useState } from "react";

// ---MUI---
import Dialog from "@mui/material/Dialog";

// ---Components---
import GeneralBudgetDialogForm from "./GeneralBudgetDialogForm";

// ---UI Components---
import Button from "@/components/ui/Button";

// ---Types---
import type { GeneralBudget } from "@/types/budget";

// Sets the month's general budget: "Set monthly budget" when there is none, "Edit" otherwise.
// Saving is an upsert, so there is no "it was deleted elsewhere" case to refresh for.
export default function GeneralBudgetDialog({
  general,
  month,
}: {
  general: GeneralBudget | null;
  month: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const close = () => setOpen(false);

  return (
    <>
      <Button
        variant={general ? "ghost" : "primary"}
        className={general ? "px-2 py-1 text-xs" : undefined}
        aria-label={general ? "Edit monthly budget" : "Set monthly budget"}
        onClick={() => setOpen(true)}
      >
        {general ? "Edit" : "Set monthly budget"}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        fullWidth
        maxWidth="xs"
        aria-labelledby={titleId}
      >
        {/* Only mounted while open, so every opening starts with a fresh form */}
        <GeneralBudgetDialogForm
          general={general}
          month={month}
          titleId={titleId}
          onClose={close}
        />
      </Dialog>
    </>
  );
}
