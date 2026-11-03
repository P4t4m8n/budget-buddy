"use client";
// ---React---
import { useId, useState } from "react";

// ---MUI---
import Dialog from "@mui/material/Dialog";

// ---Components---
import ImportFlow from "./ImportFlow";

// ---Lib---
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";

// ---Types---
import type { Category } from "@/types/finance";

// The caller owns `open`. The flow inside is only mounted while the dialog is open, so every
// opening starts again from choosing a file, and closing it throws away what was in progress.
export default function ImportDialog({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  // The user's expense categories
  categories: Category[];
}) {
  const { markStale, refreshIfStale } = useRefreshWhenStale();
  const [busy, setBusy] = useState(false);
  const titleId = useId();

  function close() {
    onClose();
    refreshIfStale();
  }

  return (
    <Dialog
      open={open}
      // Not while the rows are being saved: the result would be lost
      onClose={busy ? undefined : close}
      fullWidth
      maxWidth="md"
      aria-labelledby={titleId}
    >
      <ImportFlow
        categories={categories}
        titleId={titleId}
        onClose={close}
        onBusyChange={setBusy}
        onStale={markStale}
      />
    </Dialog>
  );
}
