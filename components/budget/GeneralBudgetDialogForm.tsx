// ---React---
import { useActionState } from "react";

// ---Actions---
import {
  setGeneralBudgetAction,
  type GeneralBudgetFormState,
} from "@/actions/budgets";

// ---Lib---
import { BASE_CURRENCY } from "@/lib/constants";
import { formatMonth } from "@/lib/format";

// ---UI Components---
import Button from "../ui/Button";
import FieldError from "../ui/FieldError";
import FormAlert from "../ui/FormAlert";
import FormField, { inputClass } from "../ui/FormField";

// ---Types---
import type { GeneralBudget } from "@/types/budget";

const initialState: GeneralBudgetFormState = { status: "idle" };

export default function GeneralBudgetDialogForm({
  general,
  month,
  titleId,
  onClose,
}: {
  general: GeneralBudget | null;
  month: string;
  titleId: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    GeneralBudgetFormState,
    FormData
  >(async (previous, formData) => {
    const result = await setGeneralBudgetAction(previous, formData);
    if (result.status === "success") onClose();
    return result;
  }, initialState);

  const errors = state.fieldErrors ?? {};
  const errorId = (field: string) => `${titleId}-${field}-error`;

  return (
    <form action={formAction} className="flex flex-col gap-4 p-6">
      <h2 id={titleId} className="text-lg font-semibold">
        {general ? "Edit monthly budget" : "Set monthly budget"}
      </h2>

      <p className="text-sm text-neutral-400">
        For {formatMonth(month)}. Everything you spend counts against it, in any
        category.
      </p>

      {/* The month is fixed by the page that opened this dialog */}
      <input type="hidden" name="month" value={month} />

      {(state.message || errors.month) && (
        <FormAlert>{state.message ?? errors.month}</FormAlert>
      )}

      <FormField label={`Limit for the month (${BASE_CURRENCY})`}>
        <input
          name="limit"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          required
          autoFocus
          defaultValue={state.values?.limit ?? general?.limit ?? ""}
          aria-invalid={Boolean(errors.limit)}
          aria-describedby={errors.limit ? errorId("limit") : undefined}
          className={inputClass}
        />
        {errors.limit && (
          <FieldError id={errorId("limit")}>{errors.limit}</FieldError>
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
