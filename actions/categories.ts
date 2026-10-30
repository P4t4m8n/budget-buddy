"use server";

import { revalidatePath } from "next/cache";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/data/categories";
import {
  CategoryInUseError,
  DuplicateCategoryError,
  NotFoundError,
} from "@/lib/data/errors";
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

export type DeleteCategoryResult =
  | { ok: true }
  | { ok: false; reason: "in_use"; transactions: number; budgets: number }
  | { ok: false; reason: "not_found" };

// A category shows up on the transactions page too (names, filter, form)
const refreshCategoryPages = () => {
  revalidatePath("/categories");
  revalidatePath("/transactions");
};

// Expected failures become messages for the form; anything else (including the
// redirect to /login for signed-out users) is rethrown on purpose
const failure = (
  error: unknown,
  values: Record<Field, string>,
): CategoryFormState => {
  if (error instanceof DuplicateCategoryError) {
    return { status: "error", fieldErrors: { name: error.message }, values };
  }
  if (error instanceof NotFoundError) {
    // No revalidatePath here: the refresh would remove this category's row, and the
    // open dialog with it, before the user could read the message. The dialog
    // refreshes the list when it is closed instead.
    return {
      status: "error",
      message:
        "This category no longer exists. It may have been deleted in another tab.",
      values,
    };
  }
  throw error;
};

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
    return failure(error, values);
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
    return failure(error, values);
  }

  refreshCategoryPages();
  return { status: "success" };
};

export const deleteCategoryAction = async (
  id: string,
): Promise<DeleteCategoryResult> => {
  // never trust the argument's type
  if (typeof id !== "string" || id === "")
    return { ok: false, reason: "not_found" };

  try {
    await deleteCategory(id);
  } catch (error) {
    if (error instanceof CategoryInUseError) {
      return {
        ok: false,
        reason: "in_use",
        transactions: error.transactions,
        budgets: error.budgets,
      };
    }
    if (error instanceof NotFoundError) {
      // The dialog refreshes the list when it closes, after showing the message
      return { ok: false, reason: "not_found" };
    }
    throw error;
  }

  refreshCategoryPages();
  return { ok: true };
};
