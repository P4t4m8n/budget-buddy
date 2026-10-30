// ---React---
import { useActionState, useState } from "react";

// ---Actions---
import {
  addDepositAction,
  updateDepositAction,
  type DepositFormState,
} from "@/actions/savings";

// ---Lib---
import { BASE_CURRENCY } from "@/lib/constants";

// ---UI Components---
import Button from "../ui/Button";
import FieldError from "../ui/FieldError";
import FormAlert from "../ui/FormAlert";
import FormField, { inputClass } from "../ui/FormField";

// ---Types---
import type { SavingsDeposit, SavingsGoal } from "@/types/finance";

const initialState: DepositFormState = { status: "idle" };

type Kind = "DEPOSIT" | "WITHDRAWAL";
const kinds: { value: Kind; label: string }[] = [
  { value: "DEPOSIT", label: "Deposit" },
  { value: "WITHDRAWAL", label: "Withdrawal" },
];

// Today in the user's own timezone, as the "YYYY-MM-DD" a date input expects
const today = () => new Date().toLocaleDateString("en-CA");

export default function DepositDialogForm({
  goal,
  deposit,
  titleId,
  onClose,
  onStale,
}: {
  goal: Pick<SavingsGoal, "id" | "name" | "currency">;
  deposit?: SavingsDeposit;
  titleId: string;
  onClose: () => void;
  onStale: () => void;
}) {
  const [kind, setKind] = useState<Kind>(
    deposit && deposit.amount < 0 ? "WITHDRAWAL" : "DEPOSIT",
  );
  const [defaultDate] = useState(today);

  const action = deposit
    ? updateDepositAction.bind(null, deposit.id)
    : addDepositAction.bind(null, goal.id);

  const [state, formAction, pending] = useActionState<
    DepositFormState,
    FormData
  >(async (previous, formData) => {
    const result = await action(previous, formData);
    if (result.status === "success") onClose();
    // The goal or the entry was deleted elsewhere: show the list as it really is
    else if (result.errorCode === "NOT_FOUND") onStale();
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
        {deposit ? "Edit entry" : "Add or withdraw money"}
      </h2>

      <p className="text-sm text-neutral-400">
        <span className="font-medium text-neutral-200">{goal.name}</span>
      </p>

      {state.message && <FormAlert>{state.message}</FormAlert>}

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/5 p-1">
        {kinds.map((k) => (
          <button
            key={k.value}
            type="button"
            aria-pressed={kind === k.value}
            onClick={() => setKind(k.value)}
            className={`rounded-md py-1.5 text-sm font-medium transition-colors ${
              kind === k.value
                ? "bg-emerald-500 text-neutral-950"
                : "text-neutral-400 hover:text-neutral-100"
            }`}
          >
            {k.label}
          </button>
        ))}
        <input type="hidden" name="kind" value={kind} />
      </div>

      <FormField label={`Amount (${BASE_CURRENCY})`}>
        <input
          name="amount"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          required
          autoFocus
          defaultValue={
            state.values?.amount ?? (deposit ? Math.abs(deposit.amount) : "")
          }
          className={inputClass}
          {...invalid("amount")}
        />
        {errors.amount && (
          <FieldError id={errorId("amount")}>{errors.amount}</FieldError>
        )}
      </FormField>

      <FormField label="Date">
        <input
          name="date"
          type="date"
          required
          defaultValue={state.values?.date ?? deposit?.date ?? defaultDate}
          className={inputClass}
          {...invalid("date")}
        />
        {errors.date && <FieldError id={errorId("date")}>{errors.date}</FieldError>}
      </FormField>

      <FormField label="Note">
        <input
          name="note"
          maxLength={250}
          defaultValue={state.values?.note ?? deposit?.note ?? ""}
          className={inputClass}
          {...invalid("note")}
        />
        {errors.note && <FieldError id={errorId("note")}>{errors.note}</FieldError>}
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
