import { z } from "zod";
import { amountSchema } from "./amount";

export const goalInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name")
    .max(80, "Keep the name under 80 characters"),
  targetAmount: amountSchema,
  // Only ILS until currency conversion exists
  currency: z.enum(["ILS"]).default("ILS"),
  targetDate: z
    .union([z.literal(""), z.iso.date("Enter a valid date")])
    .optional()
    .transform((date) => date || null),
});

export const DEPOSIT_KINDS = ["DEPOSIT", "WITHDRAWAL"] as const;

// The form asks for a plain positive amount and whether it goes in or out; the database
// stores one signed number (negative = withdrawal)
export const depositInputSchema = z
  .object({
    kind: z.enum(DEPOSIT_KINDS),
    amount: amountSchema,
    date: z.iso.date("Enter a valid date"),
    note: z
      .string()
      .trim()
      .max(200, "Keep the note under 200 characters")
      .optional()
      .transform((note) => note || null),
  })
  .transform(({ kind, amount, ...rest }) => ({
    ...rest,
    amount: kind === "WITHDRAWAL" ? -amount : amount,
  }));

export type GoalInput = z.infer<typeof goalInputSchema>;
// `amount` is signed
export type DepositInput = z.infer<typeof depositInputSchema>;
