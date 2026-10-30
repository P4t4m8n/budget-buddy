// ---React---
import { useActionState, useState } from "react";

// ---Actions---
import {
  createWishlistItemAction,
  updateWishlistItemAction,
  type WishlistFormState,
} from "@/actions/wishlist";

// ---Lib---
import { BASE_CURRENCY } from "@/lib/constants";
import { wishlistPriorityLabels, wishlistStatusLabels } from "@/lib/labels";

// ---UI Components---
import Button from "../ui/Button";
import FieldError from "../ui/FieldError";
import FormAlert from "../ui/FormAlert";
import FormField, { inputClass } from "../ui/FormField";
import SelectField from "../ui/SelectField";

// ---Types---
import type { WishlistItem } from "@/types/finance";

const initialState: WishlistFormState = { status: "idle" };

const priorityOptions = Object.entries(wishlistPriorityLabels).map(
  ([value, label]) => ({ value, label }),
);
// Purchased is reached with "Mark purchased", which also records the expense
const statusOptions = [
  { value: "WANTED", label: wishlistStatusLabels.WANTED },
  { value: "SAVING", label: wishlistStatusLabels.SAVING },
];

export default function WishlistDialogForm({
  item,
  titleId,
  onClose,
  onStale,
}: {
  item?: WishlistItem;
  titleId: string;
  onClose: () => void;
  onStale: () => void;
}) {
  const [priority, setPriority] = useState<string>(item?.priority ?? "MEDIUM");
  const [status, setStatus] = useState<string>(item?.status ?? "WANTED");

  const action = item
    ? updateWishlistItemAction.bind(null, item.id)
    : createWishlistItemAction;

  const [state, formAction, pending] = useActionState<
    WishlistFormState,
    FormData
  >(async (previous, formData) => {
    const result = await action(previous, formData);
    if (result.status === "success") onClose();
    // Deleted or purchased elsewhere: show the list as it really is once this closes
    else if (
      result.errorCode === "NOT_FOUND" ||
      result.errorCode === "INVALID_REFERENCE"
    ) {
      onStale();
    }
    return result;
  }, initialState);

  const errors = state.fieldErrors ?? {};
  const errorId = (field: string) => `${titleId}-${field}-error`;
  const invalid = (field: keyof typeof errors) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? errorId(field) : undefined,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4 p-6">
      <h2 id={titleId} className="text-lg font-semibold">
        {item ? "Edit wishlist item" : "Add wishlist item"}
      </h2>

      {state.message && <FormAlert>{state.message}</FormAlert>}

      <FormField label="Name">
        <input
          name="name"
          required
          maxLength={120}
          autoFocus
          defaultValue={state.values?.name ?? item?.name ?? ""}
          className={inputClass}
          {...invalid("name")}
        />
        {errors.name && <FieldError id={errorId("name")}>{errors.name}</FieldError>}
      </FormField>

      <FormField label={`Price (${BASE_CURRENCY})`}>
        <input
          name="price"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          required
          defaultValue={state.values?.price ?? item?.price ?? ""}
          className={inputClass}
          {...invalid("price")}
        />
        {errors.price && (
          <FieldError id={errorId("price")}>{errors.price}</FieldError>
        )}
      </FormField>

      <FormField label="Priority" labelId={`${titleId}-priority`}>
        <SelectField
          name="priority"
          labelId={`${titleId}-priority`}
          value={priority}
          onChange={setPriority}
          options={priorityOptions}
          error={Boolean(errors.priority)}
        />
        {errors.priority && (
          <FieldError id={errorId("priority")}>{errors.priority}</FieldError>
        )}
      </FormField>

      <FormField label="Status" labelId={`${titleId}-status`}>
        <SelectField
          name="status"
          labelId={`${titleId}-status`}
          value={status}
          onChange={setStatus}
          options={statusOptions}
          error={Boolean(errors.status)}
        />
        {errors.status && (
          <FieldError id={errorId("status")}>{errors.status}</FieldError>
        )}
      </FormField>

      <FormField label="Link">
        <input
          name="url"
          type="url"
          maxLength={2100}
          defaultValue={state.values?.url ?? item?.url ?? ""}
          className={inputClass}
          {...invalid("url")}
        />
        {errors.url && <FieldError id={errorId("url")}>{errors.url}</FieldError>}
      </FormField>

      <FormField label="Notes">
        <textarea
          name="notes"
          rows={2}
          maxLength={600}
          defaultValue={state.values?.notes ?? item?.notes ?? ""}
          className={inputClass}
          {...invalid("notes")}
        />
        {errors.notes && (
          <FieldError id={errorId("notes")}>{errors.notes}</FieldError>
        )}
      </FormField>

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
