import { z } from "zod";
import { TransactionType } from "@/generated/prisma/enums";

export const categoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name")
    .max(40, "Keep the name under 40 characters"),
  type: z.enum(TransactionType),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Pick a valid color")
    .transform((color) => color.toLowerCase()),
});

// A category's type is fixed once created: its transactions must keep matching it
export const categoryUpdateSchema = categoryInputSchema.omit({ type: true });

export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>;
