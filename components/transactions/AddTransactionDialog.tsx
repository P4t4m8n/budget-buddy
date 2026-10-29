"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { Category, TransactionType } from "@/types/finance";

export default function AddTransactionDialog({
  categories,
}: {
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>("expense");

  const typeCategories = categories.filter((c) => c.type === type);

  return (
    <>
      <Button variant="contained" onClick={() => setOpen(true)}>
        Add transaction
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // UI only for now: nothing is saved yet
            setOpen(false);
          }}
        >
          <DialogTitle>Add transaction</DialogTitle>
          <DialogContent className="flex flex-col gap-4 pt-2!">
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={type}
              onChange={(_, value: TransactionType | null) =>
                value && setType(value)
              }
            >
              <ToggleButton value="expense">Expense</ToggleButton>
              <ToggleButton value="income">Income</ToggleButton>
            </ToggleButtonGroup>
            <TextField name="description" label="Description" required />
            <TextField
              name="amount"
              label="Amount"
              type="number"
              required
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
            />
            <TextField
              key={type}
              select
              name="categoryId"
              label="Category"
              required
              defaultValue=""
            >
              {typeCategories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              name="date"
              label="Date"
              type="date"
              required
              defaultValue="2026-10-29"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField name="note" label="Note" multiline rows={2} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Save
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
