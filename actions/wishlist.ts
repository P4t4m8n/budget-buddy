"use server";

import { revalidatePath } from "next/cache";
import {
  createWishlistItem,
  deleteWishlistItem,
  purchaseWishlistItem,
  updateWishlistItem,
} from "@/lib/data/wishlist";
import { AppError, type ActionResult } from "@/lib/errors/app-error";
import { actionFailure, formFailure } from "@/lib/errors/handle";
import {
  readFormValues,
  validationFailure,
  type FormState,
} from "@/lib/validation/form";
import {
  purchaseInputSchema,
  wishlistInputSchema,
} from "@/lib/validation/wishlist";

const FIELDS = ["name", "price", "priority", "status", "url", "notes"] as const;
type Field = (typeof FIELDS)[number];

const PURCHASE_FIELDS = ["categoryId", "date"] as const;
type PurchaseField = (typeof PURCHASE_FIELDS)[number];

export type WishlistFormState = FormState<Field>;
export type PurchaseFormState = FormState<PurchaseField>;

// No revalidatePath when an action fails with NOT_FOUND: the refresh would remove the
// item's card, and the open dialog with it, before the user could read the message. The
// dialog refreshes the list when it is closed instead.

export const createWishlistItemAction = async (
  _previous: WishlistFormState,
  formData: FormData,
): Promise<WishlistFormState> => {
  const values = readFormValues(formData, FIELDS);
  const parsed = wishlistInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await createWishlistItem(parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  revalidatePath("/wishlist");
  return { status: "success" };
};

// Bind the id: updateWishlistItemAction.bind(null, item.id)
export const updateWishlistItemAction = async (
  id: string,
  _previous: WishlistFormState,
  formData: FormData,
): Promise<WishlistFormState> => {
  const values = readFormValues(formData, FIELDS);
  const parsed = wishlistInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await updateWishlistItem(id, parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  revalidatePath("/wishlist");
  return { status: "success" };
};

// Bind the id: purchaseWishlistItemAction.bind(null, item.id)
export const purchaseWishlistItemAction = async (
  id: string,
  _previous: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> => {
  const values = readFormValues(formData, PURCHASE_FIELDS);
  const parsed = purchaseInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);

  try {
    await purchaseWishlistItem(id, parsed.data);
  } catch (error) {
    return formFailure(error, values);
  }

  // The purchase is also an expense: it shows up in transactions, the dashboard and the
  // month's budget
  revalidatePath("/wishlist");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  return { status: "success" };
};

export const deleteWishlistItemAction = async (
  id: string,
): Promise<ActionResult> => {
  // Server Actions are public endpoints: never trust the argument's type
  if (typeof id !== "string" || id === "") {
    return actionFailure(AppError.notFound("wishlist item"));
  }

  try {
    await deleteWishlistItem(id);
  } catch (error) {
    return actionFailure(error);
  }

  revalidatePath("/wishlist");
  return { ok: true };
};
