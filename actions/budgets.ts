"use server";

import { revalidatePath } from "next/cache";
import {
  deleteBudget,
  deleteGeneralBudget,
  setBudget,
  setGeneralBudget,
} from "@/lib/data/budgets";
import { AppError, type ActionResult } from "@/lib/errors/app-error";
import { actionFailure, formFailure } from "@/lib/errors/handle";
import {
  budgetInputSchema,
  generalBudgetInputSchema,
} from "@/lib/validation/budget";
import {
  readFormValues,
  validationFailure,
  type FormState,
} from "@/lib/validation/form";

const FIELDS = ["categoryId", "month", "limit"] as const;
type Field = (typeof FIELDS)[number];

export type BudgetFormState = FormState<Field>;

const GENERAL_FIELDS = ["month", "limit"] as const;
type GeneralField = (typeof GENERAL_FIELDS)[number];

export type GeneralBudgetFormState = FormState<GeneralField>;

// The dashboard shows the month's budgets too
const refreshBudgetPages = () => {
  revalidatePath("/budget");
  revalidatePath("/dashboard");
};

// Setting the general budget creates it or changes its limit, so there is one action for both
export const setGeneralBudgetAction = async (
  _previous: GeneralBudgetFormState,
  formData: FormData,
): Promise<GeneralBudgetFormState> => {
  const values = readFormValues(formData, GENERAL_FIELDS);
  const parsed = generalBudgetInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await setGeneralBudget(parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  refreshBudgetPages();
  return { status: "success" };
};

// No revalidatePath when this fails with NOT_FOUND, for the same reason as deleteBudgetAction
export const deleteGeneralBudgetAction = async (
  id: string,
): Promise<ActionResult> => {
  // Server Actions are public endpoints: never trust the argument's type
  if (typeof id !== "string" || id === "") {
    return actionFailure(AppError.notFound("monthly budget"));
  }

  try {
    await deleteGeneralBudget(id);
  } catch (error) {
    return actionFailure(error);
  }

  refreshBudgetPages();
  return { ok: true };
};

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

  refreshBudgetPages();
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

  refreshBudgetPages();
  return { ok: true };
};
