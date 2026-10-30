"use client";
// ---React---
import { useId, useState } from "react";

// ---MUI---
import Dialog from "@mui/material/Dialog";

// ---Components---
import WishlistDialogForm from "./WishlistDialogForm";

// ---UI Components---
import Button from "@/components/ui/Button";

// ---Lib---
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";

// ---Types---
import type { WishlistItem } from "@/types/finance";

// Add when no item is passed, edit otherwise
export default function WishlistDialog({ item }: { item?: WishlistItem }) {
  const [open, setOpen] = useState(false);
  const { markStale, refreshIfStale } = useRefreshWhenStale();
  const titleId = useId();

  const close = () => {
    setOpen(false);
    refreshIfStale();
  };

  return (
    <>
      {item ? (
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs"
          aria-label={`Edit ${item.name}`}
          onClick={() => setOpen(true)}
        >
          Edit
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>Add item</Button>
      )}
      <Dialog
        open={open}
        onClose={close}
        fullWidth
        maxWidth="xs"
        aria-labelledby={titleId}
      >
        {/* Only mounted while open, so every opening starts with a fresh form */}
        <WishlistDialogForm
          item={item}
          titleId={titleId}
          onClose={close}
          onStale={markStale}
        />
      </Dialog>
    </>
  );
}
