import { z } from "zod";
import { parseMonth } from "@/lib/dates";
import { amountSchema } from "./amount";

export const budgetInputSchema = z.object({
  categoryId: z.string().min(1, "Choose a category"),
  // "YYYY-MM"
  month: z
    .string()
    .refine((month) => parseMonth(month) !== undefined, "Choose a valid month"),
  limit: amountSchema,
  // Only ILS until currency conversion exists
  currency: z.enum(["ILS"]).default("ILS"),
});

export type BudgetInput = z.infer<typeof budgetInputSchema>;
