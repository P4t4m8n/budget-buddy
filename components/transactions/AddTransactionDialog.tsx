"use client";

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import Button from "@/components/ui/Button";
import FormField, { inputClass } from "@/components/ui/FormField";
import SelectField from "@/components/ui/SelectField";
import { BASE_CURRENCY } from "@/lib/constants";
import type { Category, TransactionType } from "@/types/finance";

const types: TransactionType[] = ["expense", "income"];

export default function AddTransactionDialog({
  categories,
}: {
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>("expense");

  const categoryOptions = categories
    .filter((c) => c.type === type)
    .map((c) => ({ value: c.id, label: c.name }));

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add transaction</Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <form
          className="flex flex-col gap-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            // UI only for now: nothing is saved yet
            setOpen(false);
          }}
        >
          <h2 className="text-lg font-semibold">Add transaction</h2>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/5 p-1">
            {types.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`rounded-md py-1.5 text-sm font-medium capitalize transition-colors ${
                  type === t
                    ? "bg-emerald-500 text-neutral-950"
                    : "text-neutral-400 hover:text-neutral-100"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <FormField label="Description">
            <input name="description" required className={inputClass} />
          </FormField>
          <FormField label={`Amount (${BASE_CURRENCY})`}>
            <input
              name="amount"
              type="number"
              min={0}
              step="0.01"
              required
              className={inputClass}
            />
          </FormField>
          <input type="hidden" name="currency" value={BASE_CURRENCY} />
          <FormField label="Category">
            <SelectField
              key={type}
              name="categoryId"
              placeholder="Select a category"
              options={categoryOptions}
            />
          </FormField>
          <FormField label="Date">
            <input
              name="date"
              type="date"
              required
              defaultValue="2026-10-29"
              className={inputClass}
            />
          </FormField>
          <FormField label="Note">
            <textarea name="note" rows={2} className={inputClass} />
          </FormField>

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
