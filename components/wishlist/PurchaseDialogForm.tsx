// ---React---
import { useActionState, useState } from "react";

// ---Next---
import Link from "next/link";

// ---Actions---
import {
  purchaseWishlistItemAction,
  type PurchaseFormState,
} from "@/actions/wishlist";

// ---Lib---
import { formatCurrency } from "@/lib/format";

// ---UI Components---
import Button from "../ui/Button";
import FieldError from "../ui/FieldError";
import FormAlert from "../ui/FormAlert";
import FormField, { inputClass } from "../ui/FormField";
import SelectField from "../ui/SelectField";

// ---Types---
import type { Category, WishlistItem } from "@/types/finance";

const initialState: PurchaseFormState = { status: "idle" };

// Today in the user's own timezone, as the "YYYY-MM-DD" a date input expects
const today = () => new Date().toLocaleDateString("en-CA");

export default function PurchaseDialogForm({
  item,
  categories,
  titleId,
  onClose,
  onStale,
}: {
  item: WishlistItem;
  // The user's expense categories
  categories: Category[];
  titleId: string;
  onClose: () => void;
  onStale: () => void;
}) {
  const [defaultDate] = useState(today);
  const [categoryId, setCategoryId] = useState("");

  const [state, formAction, pending] = useActionState<
    PurchaseFormState,
    FormData
  >(async (previous, formData) => {
    const result = await purchaseWishlistItemAction(item.id, previous, formData);
    if (result.status === "success") onClose();
    // Gone, bought in another tab, or its category was deleted: show the list as it really is
    else if (
      result.errorCode === "NOT_FOUND" ||
      result.errorCode === "DUPLICATE" ||
      result.errorCode === "INVALID_REFERENCE"
    ) {
      onStale();
    }
    return result;
  }, initialState);

  const errors = state.fieldErrors ?? {};
  const errorId = (field: string) => `${titleId}-${field}-error`;
  const options = categories.map((c) => ({ value: c.id, label: c.name }));

  return (
    <form action={formAction} className="flex flex-col gap-4 p-6">
      <h2 id={titleId} className="text-lg font-semibold">
        Mark as purchased
      </h2>

      <p className="text-sm text-neutral-400">
        <span className="font-medium text-neutral-200">{item.name}</span> will be
        recorded as an expense of{" "}
        <bdi dir="ltr">{formatCurrency(item.price, item.currency)}</bdi>.
      </p>

      {(state.message || errors.categoryId) && (
        <FormAlert>{state.message ?? errors.categoryId}</FormAlert>
      )}

      <FormField label="Category" labelId={`${titleId}-category`}>
        <SelectField
          name="categoryId"
          labelId={`${titleId}-category`}
          placeholder="Select a category"
          value={categoryId}
          onChange={setCategoryId}
          options={options}
          error={Boolean(errors.categoryId)}
        />
        {options.length === 0 && (
          <span className="text-xs text-neutral-400">
            You have no expense categories yet.{" "}
            <Link href="/categories" className="text-emerald-400 hover:underline">
              Create one on the Categories page.
            </Link>
          </span>
        )}
      </FormField>

      <FormField label="Date">
        <input
          name="date"
          type="date"
          required
          defaultValue={state.values?.date ?? defaultDate}
          aria-invalid={Boolean(errors.date)}
          aria-describedby={errors.date ? errorId("date") : undefined}
          className={inputClass}
        />
        {errors.date && <FieldError id={errorId("date")}>{errors.date}</FieldError>}
      </FormField>

      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || options.length === 0}>
          {pending ? "Saving…" : "Mark purchased"}
        </Button>
      </div>
    </form>
  );
}
