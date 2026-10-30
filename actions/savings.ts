"use server";

import { revalidatePath } from "next/cache";
import {
  addDeposit,
  createGoal,
  deleteDeposit,
  deleteGoal,
  updateDeposit,
  updateGoal,
} from "@/lib/data/savings";
import { AppError, type ActionResult } from "@/lib/errors/app-error";
import { actionFailure, formFailure } from "@/lib/errors/handle";
import {
  readFormValues,
  validationFailure,
  type FormState,
} from "@/lib/validation/form";
import { depositInputSchema, goalInputSchema } from "@/lib/validation/savings";

const GOAL_FIELDS = ["name", "targetAmount", "targetDate"] as const;
type GoalField = (typeof GOAL_FIELDS)[number];

const DEPOSIT_FIELDS = ["kind", "amount", "date", "note"] as const;
type DepositField = (typeof DEPOSIT_FIELDS)[number];

export type GoalFormState = FormState<GoalField>;
export type DepositFormState = FormState<DepositField>;

// The dashboard shows what all goals hold together
const refreshSavingsPages = () => {
  revalidatePath("/savings");
  revalidatePath("/dashboard");
};

// No revalidatePath when an action fails with NOT_FOUND: the refresh would remove the
// card or row, and the open dialog with it, before the user could read the message. The
// dialog refreshes the list when it is closed instead.

export const createGoalAction = async (
  _previous: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> => {
  const values = readFormValues(formData, GOAL_FIELDS);
  const parsed = goalInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await createGoal(parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  revalidatePath("/savings");
  return { status: "success" };
};

// Bind the id: updateGoalAction.bind(null, goal.id)
export const updateGoalAction = async (
  id: string,
  _previous: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> => {
  const values = readFormValues(formData, GOAL_FIELDS);
  const parsed = goalInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await updateGoal(id, parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  revalidatePath("/savings");
  return { status: "success" };
};

export const deleteGoalAction = async (id: string): Promise<ActionResult> => {
  // Server Actions are public endpoints: never trust the argument's type
  if (typeof id !== "string" || id === "") {
    return actionFailure(AppError.notFound("savings goal"));
  }

  try {
    await deleteGoal(id);
  } catch (error) {
    return actionFailure(error);
  }

  revalidatePath("/savings");
  return { ok: true };
};

// Bind the goal's id: addDepositAction.bind(null, goal.id)
export const addDepositAction = async (
  goalId: string,
  _previous: DepositFormState,
  formData: FormData,
): Promise<DepositFormState> => {
  const values = readFormValues(formData, DEPOSIT_FIELDS);
  const parsed = depositInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await addDeposit(goalId, parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  refreshSavingsPages();
  return { status: "success" };
};

// Bind the deposit's id: updateDepositAction.bind(null, deposit.id)
export const updateDepositAction = async (
  id: string,
  _previous: DepositFormState,
  formData: FormData,
): Promise<DepositFormState> => {
  const values = readFormValues(formData, DEPOSIT_FIELDS);
  const parsed = depositInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await updateDeposit(id, parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  refreshSavingsPages();
  return { status: "success" };
};

export const deleteDepositAction = async (id: string): Promise<ActionResult> => {
  if (typeof id !== "string" || id === "") {
    return actionFailure(AppError.notFound("deposit"));
  }

  try {
    await deleteDeposit(id);
  } catch (error) {
    return actionFailure(error);
  }

  refreshSavingsPages();
  return { ok: true };
};
