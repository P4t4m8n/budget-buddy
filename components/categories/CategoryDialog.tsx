"use client";

import { useActionState, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@mui/material/Dialog";
import {
  createCategoryAction,
  updateCategoryAction,
  type CategoryFormState,
} from "@/actions/categories";
import Button from "@/components/ui/Button";
import FormField, { inputClass } from "@/components/ui/FormField";
import { CATEGORY_COLORS } from "@/lib/category-colors";
import { transactionTypeLabels } from "@/lib/labels";
import type { Category, TransactionType } from "@/types/finance";

const types: TransactionType[] = ["EXPENSE", "INCOME"];
const initialState: CategoryFormState = { status: "idle" };

// Add when no category is passed, edit otherwise
export default function CategoryDialog({ category }: { category?: Category }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const listIsStale = useRef(false);
  const titleId = useId();

  function close() {
    setOpen(false);
    // The category turned out to be gone: show the list as it really is now
    if (listIsStale.current) {
      listIsStale.current = false;
      router.refresh();
    }
  }

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
        <CategoryForm
          category={category}
          titleId={titleId}
          onClose={close}
          onStale={() => {
            listIsStale.current = true;
          }}
        />
      </Dialog>
    </>
  );
}

function CategoryForm({
  category,
  titleId,
  onClose,
  onStale,
}: {
  category?: Category;
  titleId: string;
  onClose: () => void;
  onStale: () => void;
}) {
  const [type, setType] = useState<TransactionType>(category?.type ?? "EXPENSE");
  const [color, setColor] = useState<string>(category?.color ?? CATEGORY_COLORS[0]);

  const action = category
    ? updateCategoryAction.bind(null, category.id)
    : createCategoryAction;

  const [state, formAction, pending] = useActionState<CategoryFormState, FormData>(
    async (previous, formData) => {
      const result = await action(previous, formData);
      if (result.status === "success") onClose();
      else if (result.message) onStale();
      return result;
    },
    initialState,
  );

  const errors = state.fieldErrors ?? {};
  const errorId = (field: string) => `${titleId}-${field}-error`;

  return (
    <form action={formAction} className="flex flex-col gap-4 p-6">
      <h2 id={titleId} className="text-lg font-semibold">
        {category ? "Edit category" : "Add category"}
      </h2>

      {state.message && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.message}
        </p>
      )}

      {category ? (
        // A category's type is fixed: its transactions must keep matching it
        <p className="text-sm text-neutral-400">
          Type: <span className="font-medium text-neutral-200">{transactionTypeLabels[category.type]}</span>
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/5 p-1">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={`rounded-md py-1.5 text-sm font-medium transition-colors ${
                type === t
                  ? "bg-emerald-500 text-neutral-950"
                  : "text-neutral-400 hover:text-neutral-100"
              }`}
            >
              {transactionTypeLabels[t]}
            </button>
          ))}
          <input type="hidden" name="type" value={type} />
        </div>
      )}

      <FormField label="Name">
        <input
          name="name"
          required
          maxLength={80}
          autoFocus
          defaultValue={state.values?.name ?? category?.name ?? ""}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? errorId("name") : undefined}
          className={inputClass}
        />
        {errors.name && <FieldError id={errorId("name")}>{errors.name}</FieldError>}
      </FormField>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-xs font-medium text-neutral-400">Color</legend>
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Use color ${swatch}`}
              aria-pressed={color === swatch}
              onClick={() => setColor(swatch)}
              style={{ backgroundColor: swatch }}
              className={`size-6 rounded-full ring-offset-2 ring-offset-neutral-900 ${
                color === swatch ? "ring-2 ring-white" : ""
              }`}
            />
          ))}
        </div>
        <label className="mt-1 flex w-fit items-center gap-2 text-xs text-neutral-400">
          Custom
          <input
            type="color"
            name="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Custom color"
            aria-invalid={Boolean(errors.color)}
            className="h-7 w-10 cursor-pointer rounded bg-transparent"
          />
          <span className="font-mono">{color}</span>
        </label>
        {errors.color && <FieldError id={errorId("color")}>{errors.color}</FieldError>}
      </fieldset>

      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <span id={id} className="text-xs text-red-400">
      {children}
    </span>
  );
}
