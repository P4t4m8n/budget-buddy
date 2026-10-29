"use client";

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import Button from "@/components/ui/Button";
import FormField, { inputClass } from "@/components/ui/FormField";
import SelectField from "@/components/ui/SelectField";
import { BASE_CURRENCY } from "@/lib/constants";

const priorityOptions = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const statusOptions = [
  { value: "wanted", label: "Wanted" },
  { value: "saving", label: "Saving for it" },
  { value: "purchased", label: "Purchased" },
];

export default function AddWishlistItemDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add item</Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <form
          className="flex flex-col gap-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            // UI only for now: nothing is saved yet
            setOpen(false);
          }}
        >
          <h2 className="text-lg font-semibold">Add wishlist item</h2>

          <FormField label="Name">
            <input name="name" required className={inputClass} />
          </FormField>
          <FormField label={`Price (${BASE_CURRENCY})`}>
            <input
              name="price"
              type="number"
              min={0}
              step="0.01"
              required
              className={inputClass}
            />
          </FormField>
          <input type="hidden" name="currency" value={BASE_CURRENCY} />
          <FormField label="Priority">
            <SelectField
              name="priority"
              defaultValue="medium"
              options={priorityOptions}
            />
          </FormField>
          <FormField label="Status">
            <SelectField
              name="status"
              defaultValue="wanted"
              options={statusOptions}
            />
          </FormField>
          <FormField label="Link">
            <input name="url" type="url" className={inputClass} />
          </FormField>
          <FormField label="Notes">
            <textarea name="notes" rows={2} className={inputClass} />
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
