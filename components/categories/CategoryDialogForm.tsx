// ---React---
import { useActionState, useState } from "react";

// ---Actions---
import {
  updateCategoryAction,
  createCategoryAction,
  CategoryFormState,
} from "@/actions/categories";

// ---Lib---
import { CATEGORY_COLORS } from "@/lib/category-colors";
import { transactionTypeLabels } from "@/lib/labels";

// ---UI Components---
import FieldError from "../ui/FieldError";
import FormAlert from "../ui/FormAlert";
import FormField, { inputClass } from "../ui/FormField";
import Button from "../ui/Button";

// ---Types---
import type { Category, TransactionType } from "@/types/finance";

const initialState: CategoryFormState = { status: "idle" };
const types: TransactionType[] = ["EXPENSE", "INCOME"];

interface CategoryDialogFormProps {
  category?: Category;
  titleId: string;
  onClose: () => void;
  onStale: () => void;
}
export default function CategoryDialogForm({
  category,
  titleId,
  onClose,
  onStale,
}: CategoryDialogFormProps) {
  const [type, setType] = useState<TransactionType>(
    category?.type ?? "EXPENSE",
  );
  const [color, setColor] = useState<string>(
    category?.color ?? CATEGORY_COLORS[0],
  );

  const action = category
    ? updateCategoryAction.bind(null, category.id)
    : createCategoryAction;

  const [state, formAction, pending] = useActionState<
    CategoryFormState,
    FormData
  >(async (previous, formData) => {
    const result = await action(previous, formData);
    if (result.status === "success") onClose();
    else if (result.message) onStale();
    return result;
  }, initialState);

  const errors = state.fieldErrors ?? {};
  const errorId = (field: string) => `${titleId}-${field}-error`;

  return (
    <form action={formAction} className="flex flex-col gap-4 p-6">
      <h2 id={titleId} className="text-lg font-semibold">
        {category ? "Edit category" : "Add category"}
      </h2>

      {state.message && <FormAlert>{state.message}</FormAlert>}

      {category ? (
        // A category's type is fixed: its transactions must keep matching it
        <p className="text-sm text-neutral-400">
          Type:{" "}
          <span className="font-medium text-neutral-200">
            {transactionTypeLabels[category.type]}
          </span>
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
        {errors.name && (
          <FieldError id={errorId("name")}>{errors.name}</FieldError>
        )}
      </FormField>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-xs font-medium text-neutral-400">
          Color
        </legend>
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
        {errors.color && (
          <FieldError id={errorId("color")}>{errors.color}</FieldError>
        )}
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
