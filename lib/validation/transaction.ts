import { z } from "zod";
import { TransactionType } from "@/generated/prisma/enums";

// Up to 10 digits and 2 decimals: exactly what Decimal(12, 2) can store.
// Checked on the text so values like 0.1 + 0.2 never reach the database.
const amountSchema = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : value),
  z
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 12.50")
    .transform(Number)
    .refine((amount) => amount > 0, "Amount must be greater than zero"),
);

export const transactionInputSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Enter a description")
    .max(120, "Keep the description under 120 characters"),
  amount: amountSchema,
  // Only ILS until currency conversion exists
  currency: z.enum(["ILS"]).default("ILS"),
  type: z.enum(TransactionType),
  categoryId: z.string().min(1, "Choose a category"),
  date: z.iso.date("Enter a valid date"),
  note: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters")
    .optional()
    .transform((note) => note || null),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;
