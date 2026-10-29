"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@mui/material/Dialog";
import { deleteCategoryAction } from "@/actions/categories";
import Button from "@/components/ui/Button";
import { categoryUsageText } from "@/lib/labels";
import type { Category } from "@/types/finance";

export default function DeleteCategoryButton({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const listIsStale = useRef(false);
  const titleId = useId();

  function close() {
    setOpen(false);
    setError(null);
    // The category turned out to be gone: show the list as it really is now
    if (listIsStale.current) {
      listIsStale.current = false;
      router.refresh();
    }
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteCategoryAction(category.id);

      if (result.ok) {
        close();
      } else if (result.reason === "in_use") {
        const usage = categoryUsageText(result.transactions, result.budgets);
        setError(
          usage
            ? `“${category.name}” is still used by ${usage}. Move or delete them first.`
            : `“${category.name}” is still in use. Move or delete what uses it first.`,
        );
      } else {
        listIsStale.current = true;
        setError("This category no longer exists. It may have been deleted in another tab.");
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
        aria-label={`Delete ${category.name}`}
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
            Delete category?
          </h2>
          <p className="text-sm text-neutral-300">
            “{category.name}” will be removed. Categories that transactions or
            budgets still use can&apos;t be deleted.
          </p>
          {error && (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
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
