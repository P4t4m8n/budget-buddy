"use client";

import { useActionState, useId } from "react";
import Dialog from "@mui/material/Dialog";
import {
  updateInvestmentValueAction,
  type ValueFormState,
} from "@/actions/investments";
import Button from "@/components/ui/Button";
import FieldError from "@/components/ui/FieldError";
import FormAlert from "@/components/ui/FormAlert";
import FormField, { inputClass } from "@/components/ui/FormField";
import { BASE_CURRENCY } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";
import type { InvestmentRow } from "@/types/investments";

const initialState: ValueFormState = { status: "idle" };

// Sets what the investment is worth today, which also adds today's point to its history.
// The caller owns `open`, and keeps passing the same investment while the dialog fades out.
export default function UpdateValueDialog({
  open,
  onClose,
  investment,
}: {
  open: boolean;
  onClose: () => void;
  investment?: InvestmentRow;
}) {
  const { markStale, refreshIfStale } = useRefreshWhenStale();
  const titleId = useId();

  function close() {
    onClose();
    refreshIfStale();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="xs"
      aria-labelledby={titleId}
    >
      {/* Only mounted while open, so every opening starts with a fresh form */}
      {investment && (
        <ValueForm
          investment={investment}
          titleId={titleId}
          onClose={close}
          onStale={markStale}
        />
      )}
    </Dialog>
  );
}

function ValueForm({
  investment,
  titleId,
  onClose,
  onStale,
}: {
  investment: InvestmentRow;
  titleId: string;
  onClose: () => void;
  onStale: () => void;
}) {
  const [state, formAction, pending] = useActionState<ValueFormState, FormData>(
    async (previous, formData) => {
      const result = await updateInvestmentValueAction(
        investment.id,
        previous,
        formData,
      );
      if (result.status === "success") onClose();
      else if (result.errorCode === "NOT_FOUND") onStale();
      return result;
    },
    initialState,
  );

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4 p-6">
      <h2 id={titleId} className="text-lg font-semibold">
        Update value
      </h2>

      <p className="text-sm text-neutral-400">
        <span className="font-medium text-neutral-200">{investment.name}</span>{" "}
        is currently worth{" "}
        <bdi dir="ltr">
          {formatCurrency(investment.currentValue, investment.currency)}
        </bdi>
        . The new value is saved as today&apos;s value in its history.
      </p>

      {state.message && <FormAlert>{state.message}</FormAlert>}

      <FormField label={`Value today (${BASE_CURRENCY})`}>
        <input
          name="value"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          required
          autoFocus
          defaultValue={state.values?.value ?? ""}
          aria-invalid={Boolean(errors.value)}
          aria-describedby={errors.value ? `${titleId}-value-error` : undefined}
          className={inputClass}
        />
        {errors.value && (
          <FieldError id={`${titleId}-value-error`}>{errors.value}</FieldError>
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
