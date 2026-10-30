"use server";

import { revalidatePath } from "next/cache";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/data/categories";
import { AppError, type ActionResult } from "@/lib/errors/app-error";
import { actionFailure, formFailure } from "@/lib/errors/handle";
import {
  categoryInputSchema,
  categoryUpdateSchema,
} from "@/lib/validation/category";
import {
  readFormValues,
  validationFailure,
  type FormState,
} from "@/lib/validation/form";

const FIELDS = ["name", "type", "color"] as const;
type Field = (typeof FIELDS)[number];

export type CategoryFormState = FormState<Field>;

// A category shows up on the transactions page (names, filter, form) and on the dashboard
// (the spending chart and the recent list)
const refreshCategoryPages = () => {
  revalidatePath("/categories");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
};

// No revalidatePath when an action fails with NOT_FOUND: the refresh would remove the
// category's row, and the open dialog with it, before the user could read the message.
// The dialog refreshes the list when it is closed instead.

export const createCategoryAction = async (
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> => {
  const values = readFormValues(formData, FIELDS);
  const parsed = categoryInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await createCategory(parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  refreshCategoryPages();
  return { status: "success" };
};

// Bind the id: updateCategoryAction.bind(null, category.id)
export const updateCategoryAction = async (
  id: string,
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> => {
  const values = readFormValues(formData, FIELDS);
  const parsed = categoryUpdateSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await updateCategory(id, parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  refreshCategoryPages();
  return { status: "success" };
};

export const deleteCategoryAction = async (
  id: string,
): Promise<ActionResult> => {
  // Server Actions are public endpoints: never trust the argument's type
  if (typeof id !== "string" || id === "") {
    return actionFailure(AppError.notFound("category"));
  }

  try {
    await deleteCategory(id);
  } catch (error) {
    return actionFailure(error);
  }

  refreshCategoryPages();
  return { ok: true };
};
