import { z } from "zod";
import { WishlistPriority } from "@/generated/prisma/enums";
import { amountSchema } from "./amount";

// The link is rendered as an <a href>, so anything but http(s) (javascript:, data:) is refused
const isHttpUrl = (value: string) => {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

export const wishlistInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name")
    .max(80, "Keep the name under 80 characters"),
  price: amountSchema,
  // Only ILS until currency conversion exists
  currency: z.enum(["ILS"]).default("ILS"),
  priority: z.enum(WishlistPriority),
  // PURCHASED is not a choice here: it is only reached by purchasing the item, which
  // records the expense (see purchaseInputSchema)
  status: z.enum(["WANTED", "SAVING"]),
  url: z
    .string()
    .trim()
    .max(2000, "Keep the link under 2000 characters")
    .refine(
      (url) => url === "" || isHttpUrl(url),
      "Enter a link starting with http:// or https://",
    )
    .optional()
    .transform((url) => url || null),
  notes: z
    .string()
    .trim()
    .max(500, "Keep the notes under 500 characters")
    .optional()
    .transform((notes) => notes || null),
});

// What the purchase needs on top of the item itself: the expense is recorded with the
// item's name and price
export const purchaseInputSchema = z.object({
  categoryId: z.string().min(1, "Choose a category"),
  date: z.iso.date("Enter a valid date"),
});

export type WishlistInput = z.infer<typeof wishlistInputSchema>;
export type PurchaseInput = z.infer<typeof purchaseInputSchema>;
