"use client";

import { useActionState, useId, useState } from "react";
import Dialog from "@mui/material/Dialog";
import {
  createInvestmentAction,
  updateInvestmentAction,
  type InvestmentFormState,
} from "@/actions/investments";
import Button from "@/components/ui/Button";
import FieldError from "@/components/ui/FieldError";
import FormAlert from "@/components/ui/FormAlert";
import FormField, { inputClass } from "@/components/ui/FormField";
import SelectField from "@/components/ui/SelectField";
import { BASE_CURRENCY } from "@/lib/constants";
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";
import { investmentTypeLabels } from "@/lib/labels";
import type { InvestmentRow } from "@/types/investments";

const initialState: InvestmentFormState = { status: "idle" };

const typeOptions = Object.entries(investmentTypeLabels).map(
  ([value, label]) => ({ value, label }),
);

// Add when no investment is passed, edit otherwise. The caller owns `open`, and keeps
// passing the same investment while the dialog fades out.
export default function InvestmentFormDialog({
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
      <InvestmentForm
        investment={investment}
        titleId={titleId}
        onClose={close}
        onStale={markStale}
      />
    </Dialog>
  );
}

function InvestmentForm({
  investment,
  titleId,
  onClose,
  onStale,
}: {
  investment?: InvestmentRow;
  titleId: string;
  onClose: () => void;
  onStale: () => void;
}) {
  const [type, setType] = useState<string>(investment?.type ?? "STOCK");

  const action = investment
    ? updateInvestmentAction.bind(null, investment.id)
    : createInvestmentAction;

  const [state, formAction, pending] = useActionState<
    InvestmentFormState,
    FormData
  >(async (previous, formData) => {
    const result = await action(previous, formData);
    if (result.status === "success") onClose();
    // Deleted elsewhere: show the list as it really is once this closes
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
        {investment ? "Edit investment" : "Add investment"}
      </h2>

      {state.message && <FormAlert>{state.message}</FormAlert>}

      <FormField label="Name">
        <input
          name="name"
          required
          maxLength={120}
          autoFocus
          defaultValue={state.values?.name ?? investment?.name ?? ""}
          className={inputClass}
          {...invalid("name")}
        />
        {errors.name && (
          <FieldError id={errorId("name")}>{errors.name}</FieldError>
        )}
      </FormField>

      <FormField label="Type" labelId={`${titleId}-type`}>
        <SelectField
          name="type"
          labelId={`${titleId}-type`}
          value={type}
          onChange={setType}
          options={typeOptions}
          error={Boolean(errors.type)}
        />
        {errors.type && (
          <FieldError id={errorId("type")}>{errors.type}</FieldError>
        )}
      </FormField>

      <FormField label="Ticker (optional)">
        <input
          name="ticker"
          maxLength={30}
          defaultValue={state.values?.ticker ?? investment?.ticker ?? ""}
          className={inputClass}
          {...invalid("ticker")}
        />
        {errors.ticker && (
          <FieldError id={errorId("ticker")}>{errors.ticker}</FieldError>
        )}
      </FormField>

      <FormField label={`Amount invested (${BASE_CURRENCY})`}>
        <input
          name="amountInvested"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          required
          defaultValue={
            state.values?.amountInvested ?? investment?.amountInvested ?? ""
          }
          className={inputClass}
          {...invalid("amountInvested")}
        />
        {errors.amountInvested && (
          <FieldError id={errorId("amountInvested")}>
            {errors.amountInvested}
          </FieldError>
        )}
      </FormField>

      {investment ? (
        // What it is worth is changed with "Update value", which also keeps the history
        <p className="text-xs text-neutral-500">
          To change what it is worth today, use Update value.
        </p>
      ) : (
        <FormField label={`Current value (${BASE_CURRENCY})`}>
          <input
            name="currentValue"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            required
            defaultValue={state.values?.currentValue ?? ""}
            className={inputClass}
            {...invalid("currentValue")}
          />
          {errors.currentValue && (
            <FieldError id={errorId("currentValue")}>
              {errors.currentValue}
            </FieldError>
          )}
        </FormField>
      )}

      <FormField label="Purchase date">
        <input
          name="purchaseDate"
          type="date"
          required
          defaultValue={
            state.values?.purchaseDate ?? investment?.purchaseDate ?? ""
          }
          className={inputClass}
          {...invalid("purchaseDate")}
        />
        {errors.purchaseDate && (
          <FieldError id={errorId("purchaseDate")}>
            {errors.purchaseDate}
          </FieldError>
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
