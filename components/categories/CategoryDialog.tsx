"use client";
// ---React---
import { useId, useState } from "react";

// ---MUI---
import Dialog from "@mui/material/Dialog";

// ---Components---
import CategoryDialogForm from "./CategoryDialogForm";

// ---UI Components---
import Button from "@/components/ui/Button";

// ---Lib---
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";

// ---Types---
import type { Category } from "@/types/finance";

// Add when no category is passed, edit otherwise
export default function CategoryDialog({ category }: { category?: Category }) {
  const [open, setOpen] = useState(false);
  const { markStale, refreshIfStale } = useRefreshWhenStale();
  const titleId = useId();

  const close = () => {
    setOpen(false);
    refreshIfStale();
  };

  return (
    <>
      {category ? (
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs"
          aria-label={`Edit ${category.name}`}
          onClick={() => setOpen(true)}
        >
          Edit
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>Add category</Button>
      )}
      <Dialog
        open={open}
        onClose={close}
        fullWidth
        maxWidth="xs"
        aria-labelledby={titleId}
      >
        {/* Only mounted while open, so every opening starts with a fresh form */}
        <CategoryDialogForm
          category={category}
          titleId={titleId}
          onClose={close}
          onStale={markStale}
        />
      </Dialog>
    </>
  );
}
