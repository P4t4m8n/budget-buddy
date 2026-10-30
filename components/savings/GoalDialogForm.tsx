// ---React---
import { useActionState } from "react";

// ---Actions---
import {
  createGoalAction,
  updateGoalAction,
  type GoalFormState,
} from "@/actions/savings";

// ---Lib---
import { BASE_CURRENCY } from "@/lib/constants";

// ---UI Components---
import Button from "../ui/Button";
import FieldError from "../ui/FieldError";
import FormAlert from "../ui/FormAlert";
import FormField, { inputClass } from "../ui/FormField";

// ---Types---
import type { SavingsGoal } from "@/types/finance";

const initialState: GoalFormState = { status: "idle" };

export default function GoalDialogForm({
  goal,
  titleId,
  onClose,
  onStale,
}: {
  goal?: SavingsGoal;
  titleId: string;
  onClose: () => void;
  onStale: () => void;
}) {
  const action = goal ? updateGoalAction.bind(null, goal.id) : createGoalAction;

  const [state, formAction, pending] = useActionState<GoalFormState, FormData>(
    async (previous, formData) => {
      const result = await action(previous, formData);
      if (result.status === "success") onClose();
      // Deleted elsewhere: show the list as it really is once this closes
      else if (result.errorCode === "NOT_FOUND") onStale();
      return result;
    },
    initialState,
  );

  const errors = state.fieldErrors ?? {};
  const errorId = (field: string) => `${titleId}-${field}-error`;
  const invalid = (field: keyof typeof errors) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? errorId(field) : undefined,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4 p-6">
      <h2 id={titleId} className="text-lg font-semibold">
        {goal ? "Edit savings goal" : "Add savings goal"}
      </h2>

      {state.message && <FormAlert>{state.message}</FormAlert>}

      <FormField label="Name">
        <input
          name="name"
          required
          maxLength={120}
          autoFocus
          defaultValue={state.values?.name ?? goal?.name ?? ""}
          className={inputClass}
          {...invalid("name")}
        />
        {errors.name && <FieldError id={errorId("name")}>{errors.name}</FieldError>}
      </FormField>

      <FormField label={`Target amount (${BASE_CURRENCY})`}>
        <input
          name="targetAmount"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          required
          defaultValue={state.values?.targetAmount ?? goal?.targetAmount ?? ""}
          className={inputClass}
          {...invalid("targetAmount")}
        />
        {errors.targetAmount && (
          <FieldError id={errorId("targetAmount")}>{errors.targetAmount}</FieldError>
        )}
      </FormField>

      <FormField label="Target date (optional)">
        <input
          name="targetDate"
          type="date"
          defaultValue={state.values?.targetDate ?? goal?.targetDate ?? ""}
          className={inputClass}
          {...invalid("targetDate")}
        />
        {errors.targetDate && (
          <FieldError id={errorId("targetDate")}>{errors.targetDate}</FieldError>
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
