"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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

type Field = "name" | "type" | "color";

export type CategoryFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<Field, string>>;
  // Sent back so the form can refill itself: React clears uncontrolled fields after an action
  values?: Record<Field, string>;
};

export type DeleteCategoryResult =
  | { ok: true }
  | { ok: false; reason: "in_use"; transactions: number; budgets: number }
  | { ok: false; reason: "not_found" };

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const readValues = (formData: FormData) => ({
  name: text(formData, "name"),
  type: text(formData, "type"),
  color: text(formData, "color"),
});

function validationError(
  error: z.ZodError,
  values: Record<Field, string>,
): CategoryFormState {
  const { fieldErrors: flat } = z.flattenError(error) as {
    fieldErrors: Record<string, string[] | undefined>;
  };
  const fieldErrors: CategoryFormState["fieldErrors"] = {};
  for (const [field, messages] of Object.entries(flat)) {
    if (messages?.[0]) fieldErrors[field as Field] = messages[0];
  }
  return { status: "error", fieldErrors, values };
}

// Expected failures become messages for the form; anything else (including the
// redirect to /login for signed-out users) is rethrown on purpose
function failure(
  error: unknown,
  values: Record<Field, string>,
): CategoryFormState {
  if (error instanceof DuplicateCategoryError) {
    return { status: "error", fieldErrors: { name: error.message }, values };
  }
  if (error instanceof NotFoundError) {
    // No revalidatePath here: the refresh would remove this category's row, and the
    // open dialog with it, before the user could read the message. The dialog
    // refreshes the list when it is closed instead.
    return {
      status: "error",
      message: "This category no longer exists. It may have been deleted in another tab.",
      values,
    };
  }
  throw error;
}

export async function createCategoryAction(
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const values = readValues(formData);
  const parsed = categoryInputSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  try {
    await createCategory(parsed.data);
  } catch (error) {
    return failure(error, values);
  }

  revalidatePath("/categories");
  return { status: "success" };
}

// Bind the id: updateCategoryAction.bind(null, category.id)
export async function updateCategoryAction(
  id: string,
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const values = readValues(formData);
  const parsed = categoryUpdateSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  try {
    await updateCategory(id, parsed.data);
  } catch (error) {
    return failure(error, values);
  }

  revalidatePath("/categories");
  return { status: "success" };
}

export async function deleteCategoryAction(
  id: string,
): Promise<DeleteCategoryResult> {
  // Server Actions are public endpoints: never trust the argument's type
  if (typeof id !== "string" || id === "") return { ok: false, reason: "not_found" };

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

  revalidatePath("/categories");
  return { ok: true };
}
