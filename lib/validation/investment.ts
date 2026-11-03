import { z } from "zod";
import { InvestmentType } from "@/generated/prisma/enums";
import { amountSchema, valueSchema } from "./amount";

const investmentFields = {
  name: z
    .string()
    .trim()
    .min(1, "Enter a name")
    .max(80, "Keep the name under 80 characters"),
  type: z.enum(InvestmentType),
  ticker: z
    .string()
    .trim()
    .max(15, "Keep the ticker under 15 characters")
    .optional()
    .transform((ticker) => ticker?.toUpperCase() || null),
  amountInvested: amountSchema,
  // Only ILS until currency conversion exists
  currency: z.enum(["ILS"]).default("ILS"),
  purchaseDate: z.iso.date("Enter a valid date"),
};

// What an investment is worth today is not part of editing it: it has its own action,
// which also records the value in the history
export const investmentUpdateSchema = z.object(investmentFields);

export const investmentInputSchema = z.object({
  ...investmentFields,
  currentValue: valueSchema,
});

export const valueUpdateSchema = z.object({ value: valueSchema });

export type InvestmentInput = z.infer<typeof investmentInputSchema>;
export type InvestmentUpdate = z.infer<typeof investmentUpdateSchema>;
export type ValueUpdate = z.infer<typeof valueUpdateSchema>;
