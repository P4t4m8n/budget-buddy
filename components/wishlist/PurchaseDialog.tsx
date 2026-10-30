"use client";
// ---React---
import { useId, useState } from "react";

// ---MUI---
import Dialog from "@mui/material/Dialog";

// ---Components---
import PurchaseDialogForm from "./PurchaseDialogForm";

// ---UI Components---
import Button from "@/components/ui/Button";

// ---Lib---
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";

// ---Types---
import type { Category, WishlistItem } from "@/types/finance";

// Marks an item as bought and records the expense for it
export default function PurchaseDialog({
  item,
  categories,
}: {
  item: WishlistItem;
  categories: Category[];
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
      <Button
        variant="ghost"
        className="px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300"
        aria-label={`Mark ${item.name} as purchased`}
        onClick={() => setOpen(true)}
      >
        Mark purchased
      </Button>
      <Dialog
        open={open}
        onClose={close}
        fullWidth
        maxWidth="xs"
        aria-labelledby={titleId}
      >
        {/* Only mounted while open, so every opening starts with a fresh form */}
        <PurchaseDialogForm
          item={item}
          categories={categories}
          titleId={titleId}
          onClose={close}
          onStale={markStale}
        />
      </Dialog>
    </>
  );
}
