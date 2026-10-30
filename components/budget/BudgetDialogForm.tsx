// ---React---
import { useActionState } from "react";

// ---Actions---
import { setBudgetAction, type BudgetFormState } from "@/actions/budgets";

// ---Lib---
import { BASE_CURRENCY } from "@/lib/constants";
import { formatMonth } from "@/lib/format";

// ---UI Components---
import Button from "../ui/Button";
import FieldError from "../ui/FieldError";
import FormAlert from "../ui/FormAlert";
import FormField, { inputClass } from "../ui/FormField";

// ---Types---
import type { BudgetRow } from "@/types/budget";

const initialState: BudgetFormState = { status: "idle" };

export default function BudgetDialogForm({
  row,
  month,
  titleId,
  onClose,
  onStale,
}: {
  row: BudgetRow;
  month: string;
  titleId: string;
  onClose: () => void;
  onStale: () => void;
}) {
  const [state, formAction, pending] = useActionState<BudgetFormState, FormData>(
    async (previous, formData) => {
      const result = await setBudgetAction(previous, formData);
      if (result.status === "success") onClose();
      // The category was deleted elsewhere: show the list as it really is once this closes
      else if (result.errorCode === "INVALID_REFERENCE") onStale();
      return result;
    },
    initialState,
  );

  const errors = state.fieldErrors ?? {};
  const errorId = (field: string) => `${titleId}-${field}-error`;

  return (
    <form action={formAction} className="flex flex-col gap-4 p-6">
      <h2 id={titleId} className="text-lg font-semibold">
        {row.budgetId ? "Edit budget" : "Set budget"}
      </h2>

      <p className="text-sm text-neutral-400">
        <span className="font-medium text-neutral-200">{row.name}</span> in{" "}
        {formatMonth(month)}
      </p>

      {/* The category and month are fixed by the row that opened this dialog */}
      <input type="hidden" name="categoryId" value={row.categoryId} />
      <input type="hidden" name="month" value={month} />

      {(state.message || errors.categoryId || errors.month) && (
        <FormAlert>
          {state.message ?? errors.categoryId ?? errors.month}
        </FormAlert>
      )}

      <FormField label={`Monthly limit (${BASE_CURRENCY})`}>
        <input
          name="limit"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          required
          autoFocus
          defaultValue={state.values?.limit ?? row.limit ?? ""}
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
