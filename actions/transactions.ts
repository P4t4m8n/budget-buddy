"use server";

import { revalidatePath } from "next/cache";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/lib/data/transactions";
import { CategoryMismatchError, NotFoundError } from "@/lib/data/errors";
import {
  readFormValues,
  validationFailure,
  type FormState,
} from "@/lib/validation/form";
import { transactionInputSchema } from "@/lib/validation/transaction";

const FIELDS = ["description", "amount", "type", "categoryId", "date", "note"] as const;
type Field = (typeof FIELDS)[number];

export type TransactionFormState = FormState<Field>;

export type DeleteTransactionResult =
  | { ok: true }
  | { ok: false; reason: "not_found" };

function refreshTransactionPages() {
  revalidatePath("/transactions");
}

// Expected failures become messages for the form; anything else (including the
// redirect to /login for signed-out users) is rethrown on purpose
function failure(
  error: unknown,
  values: Record<Field, string>,
): TransactionFormState {
  if (error instanceof CategoryMismatchError) {
    return { status: "error", fieldErrors: { categoryId: error.message }, values };
  }
  if (error instanceof NotFoundError) {
    // No revalidatePath here: the refresh would remove this row, and the open dialog
    // with it, before the user could read the message. The dialog refreshes the list
    // when it is closed instead.
    return {
      status: "error",
      message: "This transaction no longer exists. It may have been deleted in another tab.",
      values,
    };
  }
  throw error;
}

export async function createTransactionAction(
  _previous: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const values = readFormValues(formData, FIELDS);
  const parsed = transactionInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await createTransaction(parsed.data);
  } catch (error) {
    return failure(error, values);
  }

  refreshTransactionPages();
  return { status: "success" };
}

// Bind the id: updateTransactionAction.bind(null, transaction.id)
export async function updateTransactionAction(
  id: string,
  _previous: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const values = readFormValues(formData, FIELDS);
  const parsed = transactionInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await updateTransaction(id, parsed.data);
  } catch (error) {
    return failure(error, values);
  }

  refreshTransactionPages();
  return { status: "success" };
}

export async function deleteTransactionAction(
  id: string,
): Promise<DeleteTransactionResult> {
  // Server Actions are public endpoints: never trust the argument's type
  if (typeof id !== "string" || id === "") return { ok: false, reason: "not_found" };

  try {
    await deleteTransaction(id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      // The dialog refreshes the list when it closes, after showing the message
      return { ok: false, reason: "not_found" };
    }
    throw error;
  }

  refreshTransactionPages();
  return { ok: true };
}
