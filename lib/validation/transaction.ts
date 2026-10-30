import { z } from "zod";
import { TransactionType } from "@/generated/prisma/enums";
import { amountSchema } from "./amount";

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
