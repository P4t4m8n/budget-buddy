"use server";

import { revalidatePath } from "next/cache";
import {
  createTransaction,
  createTransactions,
  deleteTransaction,
  updateTransaction,
} from "@/lib/data/transactions";
import { AppError } from "@/lib/errors/app-error";
import { actionFailure, formFailure } from "@/lib/errors/handle";
import {
  readFormValues,
  validationFailure,
  type FormState,
} from "@/lib/validation/form";
import { importInputSchema } from "@/lib/validation/transaction-import";
import { transactionInputSchema } from "@/lib/validation/transaction";
import type { ActionFailure, ActionResult } from "@/lib/errors/errors.type";

const FIELDS = [
  "description",
  "amount",
  "type",
  "categoryId",
  "date",
  "note",
] as const;
type Field = (typeof FIELDS)[number];

export type TransactionFormState = FormState<Field>;

// The dashboard shows totals, charts and the newest transactions, so it changes too
const refreshTransactionPages = () => {
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
};

// No revalidatePath when an action fails with NOT_FOUND: the refresh would remove the
// row, and the open dialog with it, before the user could read the message. The dialog
// refreshes the list when it is closed instead.

export const createTransactionAction = async (
  _previous: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> => {
  const values = readFormValues(formData, FIELDS);
  const parsed = transactionInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await createTransaction(parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  refreshTransactionPages();
  return { status: "success" };
};

// Bind the id: updateTransactionAction.bind(null, transaction.id)
export const updateTransactionAction = async (
  id: string,
  _previous: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> => {
  const values = readFormValues(formData, FIELDS);
  const parsed = transactionInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await updateTransaction(id, parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  refreshTransactionPages();
  return { status: "success" };
};

export const deleteTransactionAction = async (
  id: string,
): Promise<ActionResult> => {
  // Server Actions are public endpoints: never trust the argument's type
  if (typeof id !== "string" || id === "") {
    return actionFailure(AppError.notFound("transaction"));
  }

  try {
    await deleteTransaction(id);
  } catch (error) {
    return actionFailure(error);
  }

  refreshTransactionPages();
  return { ok: true };
};

export type ImportResult = { ok: true; count: number } | ActionFailure;

// Adds the rows of an imported file, each with the category the user chose for it, as
// expenses. All of them or none. The browser has already checked every row, but this is a
// public endpoint, so everything is checked again.
export const importTransactionsAction = async (
  rows: unknown,
): Promise<ImportResult> => {
  const parsed = importInputSchema.safeParse(rows);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const row = typeof issue.path[0] === "number" ? issue.path[0] + 1 : null;
    return actionFailure(
      AppError.invalidInput(
        row === null ? issue.message : `Row ${row}: ${issue.message}`,
      ),
    );
  }

  let count: number;
  try {
    count = await createTransactions(parsed.data);
  } catch (error) {
    return actionFailure(error);
  }

  // Imported expenses also change the dashboard and the month's budgets
  refreshTransactionPages();
  revalidatePath("/budget");
  return { ok: true, count };
};
