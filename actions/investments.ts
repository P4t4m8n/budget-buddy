"use server";

import { revalidatePath } from "next/cache";
import {
  createInvestment,
  deleteInvestment,
  updateInvestment,
  updateInvestmentValue,
} from "@/lib/data/investments";
import { AppError, type ActionResult } from "@/lib/errors/app-error";
import { actionFailure, formFailure } from "@/lib/errors/handle";
import {
  investmentInputSchema,
  investmentUpdateSchema,
  valueUpdateSchema,
} from "@/lib/validation/investment";
import {
  readFormValues,
  validationFailure,
  type FormState,
} from "@/lib/validation/form";

const FIELDS = [
  "name",
  "type",
  "ticker",
  "amountInvested",
  "currentValue",
  "purchaseDate",
] as const;
type Field = (typeof FIELDS)[number];

const VALUE_FIELDS = ["value"] as const;
type ValueField = (typeof VALUE_FIELDS)[number];

export type InvestmentFormState = FormState<Field>;
export type ValueFormState = FormState<ValueField>;

// Investments only show up on the savings page
const refreshInvestments = () => revalidatePath("/savings");

// No revalidatePath when an action fails with NOT_FOUND: the refresh would remove the
// row, and the open dialog with it, before the user could read the message. The dialog
// refreshes the list when it is closed instead.

export const createInvestmentAction = async (
  _previous: InvestmentFormState,
  formData: FormData,
): Promise<InvestmentFormState> => {
  const values = readFormValues(formData, FIELDS);
  const parsed = investmentInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await createInvestment(parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  refreshInvestments();
  return { status: "success" };
};

// Bind the id: updateInvestmentAction.bind(null, investment.id). The form has no current
// value: that is changed with updateInvestmentValueAction.
export const updateInvestmentAction = async (
  id: string,
  _previous: InvestmentFormState,
  formData: FormData,
): Promise<InvestmentFormState> => {
  const values = readFormValues(formData, FIELDS);
  const parsed = investmentUpdateSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await updateInvestment(id, parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  refreshInvestments();
  return { status: "success" };
};

// Bind the id: updateInvestmentValueAction.bind(null, investment.id)
export const updateInvestmentValueAction = async (
  id: string,
  _previous: ValueFormState,
  formData: FormData,
): Promise<ValueFormState> => {
  const values = readFormValues(formData, VALUE_FIELDS);
  const parsed = valueUpdateSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await updateInvestmentValue(id, parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  refreshInvestments();
  return { status: "success" };
};

export const deleteInvestmentAction = async (
  id: string,
): Promise<ActionResult> => {
  // Server Actions are public endpoints: never trust the argument's type
  if (typeof id !== "string" || id === "") {
    return actionFailure(AppError.notFound("investment"));
  }

  try {
    await deleteInvestment(id);
  } catch (error) {
    return actionFailure(error);
  }

  refreshInvestments();
  return { ok: true };
};
