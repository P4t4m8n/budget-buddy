import { z } from "zod";

const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const AMOUNT_MESSAGE = "Enter an amount like 12.50";

const asText = (value: unknown) =>
  typeof value === "number" ? String(value) : value;

// Up to 10 digits and 2 decimals: exactly what Decimal(12, 2) can store.
// Checked on the text so values like 0.1 + 0.2 never reach the database.
export const amountSchema = z.preprocess(
  asText,
  z
    .string()
    .trim()
    .regex(AMOUNT_PATTERN, AMOUNT_MESSAGE)
    .transform(Number)
    .refine((amount) => amount > 0, "Amount must be greater than zero"),
);

// Same, but zero is fine: something that is worth nothing now is still a real value
export const valueSchema = z.preprocess(
  asText,
  z.string().trim().regex(AMOUNT_PATTERN, AMOUNT_MESSAGE).transform(Number),
);
