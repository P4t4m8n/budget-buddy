import { z } from "zod";

// Up to 10 digits and 2 decimals: exactly what Decimal(12, 2) can store.
// Checked on the text so values like 0.1 + 0.2 never reach the database.
export const amountSchema = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : value),
  z
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 12.50")
    .transform(Number)
    .refine((amount) => amount > 0, "Amount must be greater than zero"),
);
