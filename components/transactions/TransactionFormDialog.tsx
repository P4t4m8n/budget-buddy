"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import Dialog from "@mui/material/Dialog";
import {
  createTransactionAction,
  updateTransactionAction,
  type TransactionFormState,
} from "@/actions/transactions";
import Button from "@/components/ui/Button";
import FieldError from "@/components/ui/FieldError";
import FormAlert from "@/components/ui/FormAlert";
import FormField, { inputClass } from "@/components/ui/FormField";
import SelectField from "@/components/ui/SelectField";
import { BASE_CURRENCY } from "@/lib/constants";
import { useRefreshWhenStale } from "@/lib/hooks/use-refresh-when-stale";
import { transactionTypeLabels } from "@/lib/labels";
import type { Category, TransactionType } from "@/types/finance";
import type { TransactionRow } from "./transaction-row";

const types: TransactionType[] = ["EXPENSE", "INCOME"];
const initialState: TransactionFormState = { status: "idle" };

// Add when no transaction is passed, edit otherwise. The caller owns `open`, and keeps
// passing the same transaction while the dialog fades out.
export default function TransactionFormDialog({
  open,
  onClose,
  transaction,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  transaction?: TransactionRow;
  categories: Category[];
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
      <TransactionForm
        transaction={transaction}
        categories={categories}
        titleId={titleId}
        onClose={close}
        onStale={markStale}
      />
    </Dialog>
  );
}

// Today in the user's own timezone, as the "YYYY-MM-DD" a date input expects
const today = () => new Date().toLocaleDateString("en-CA");

function TransactionForm({
  transaction,
  categories,
  titleId,
  onClose,
  onStale,
}: {
  transaction?: TransactionRow;
  categories: Category[];
  titleId: string;
  onClose: () => void;
  onStale: () => void;
}) {
  const [type, setType] = useState<TransactionType>(transaction?.type ?? "EXPENSE");
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [defaultDate] = useState(today);

  const action = transaction
    ? updateTransactionAction.bind(null, transaction.id)
    : createTransactionAction;

  const [state, formAction, pending] = useActionState<TransactionFormState, FormData>(
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
  const invalid = (field: keyof typeof errors) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? errorId(field) : undefined,
  });

  const categoryOptions = categories
    .filter((category) => category.type === type)
    .map((category) => ({ value: category.id, label: category.name }));
  const typeLabel = transactionTypeLabels[type].toLowerCase();

  function chooseType(next: TransactionType) {
    if (next === type) return;
    setType(next);
    // The old category belongs to the other type
    setCategoryId("");
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 p-6">
      <h2 id={titleId} className="text-lg font-semibold">
        {transaction ? "Edit transaction" : "Add transaction"}
      </h2>

      {state.message && <FormAlert>{state.message}</FormAlert>}

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/5 p-1">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            onClick={() => chooseType(t)}
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

      <FormField label="Description">
        <input
          name="description"
          required
          maxLength={200}
          autoFocus
          defaultValue={state.values?.description ?? transaction?.description ?? ""}
          className={inputClass}
          {...invalid("description")}
        />
        {errors.description && (
          <FieldError id={errorId("description")}>{errors.description}</FieldError>
        )}
      </FormField>

      <FormField label={`Amount (${BASE_CURRENCY})`}>
        <input
          name="amount"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          required
          defaultValue={state.values?.amount ?? transaction?.amount ?? ""}
          className={inputClass}
          {...invalid("amount")}
        />
        {errors.amount && <FieldError id={errorId("amount")}>{errors.amount}</FieldError>}
      </FormField>

      <FormField label="Category" labelId={`${titleId}-category`}>
        <SelectField
          name="categoryId"
          labelId={`${titleId}-category`}
          placeholder="Select a category"
          value={categoryId}
          onChange={setCategoryId}
          options={categoryOptions}
          error={Boolean(errors.categoryId)}
        />
        {errors.categoryId && (
          <FieldError id={errorId("categoryId")}>{errors.categoryId}</FieldError>
        )}
        {categoryOptions.length === 0 && (
          <span className="text-xs text-neutral-400">
            You have no {typeLabel} categories yet.{" "}
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
          defaultValue={state.values?.date ?? transaction?.date ?? defaultDate}
          className={inputClass}
          {...invalid("date")}
        />
        {errors.date && <FieldError id={errorId("date")}>{errors.date}</FieldError>}
      </FormField>

      <FormField label="Note">
        <textarea
          name="note"
          rows={2}
          maxLength={500}
          defaultValue={state.values?.note ?? transaction?.note ?? ""}
          className={inputClass}
          {...invalid("note")}
        />
        {errors.note && <FieldError id={errorId("note")}>{errors.note}</FieldError>}
      </FormField>

      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || categoryOptions.length === 0}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
