import { z } from "zod";
import { MAX_IMPORT_ROWS } from "@/lib/import/types";
import { transactionInputSchema } from "./transaction";

// One row of an import, as the browser sends it: a category chosen for a row of the file.
// Every imported row is an expense in ILS, so those aren't part of what is sent.
export const importRowSchema = transactionInputSchema.pick({
  description: true,
  amount: true,
  date: true,
  categoryId: true,
});

export const importInputSchema = z
  .array(importRowSchema)
  .min(1, "There is nothing to import")
  .max(
    MAX_IMPORT_ROWS,
    `Import up to ${MAX_IMPORT_ROWS} transactions at a time`,
  );

export type ImportRowInput = z.infer<typeof importRowSchema>;
