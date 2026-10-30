"use server";

import { revalidatePath } from "next/cache";
import { deleteBudget, setBudget } from "@/lib/data/budgets";
import { AppError, type ActionResult } from "@/lib/errors/app-error";
import { actionFailure, formFailure } from "@/lib/errors/handle";
import { budgetInputSchema } from "@/lib/validation/budget";
import {
  readFormValues,
  validationFailure,
  type FormState,
} from "@/lib/validation/form";

const FIELDS = ["categoryId", "month", "limit"] as const;
type Field = (typeof FIELDS)[number];

export type BudgetFormState = FormState<Field>;

// Setting a budget creates it or changes its limit, so there is one action for both
export const setBudgetAction = async (
  _previous: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> => {
  const values = readFormValues(formData, FIELDS);
  const parsed = budgetInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await setBudget(parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  revalidatePath("/budget");
  return { status: "success" };
};

// No revalidatePath when this fails with NOT_FOUND: the refresh would remove the row, and
// the open dialog with it, before the user could read the message. The dialog refreshes the
// list when it is closed instead.
export const deleteBudgetAction = async (
  id: string,
): Promise<ActionResult> => {
  // Server Actions are public endpoints: never trust the argument's type
  if (typeof id !== "string" || id === "") {
    return actionFailure(AppError.notFound("budget"));
  }

  try {
    await deleteBudget(id);
  } catch (error) {
    return actionFailure(error);
  }

  revalidatePath("/budget");
  return { ok: true };
};
