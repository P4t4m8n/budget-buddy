"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";

export default function AddWishlistItemDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="contained" onClick={() => setOpen(true)}>
        Add item
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // UI only for now: nothing is saved yet
            setOpen(false);
          }}
        >
          <DialogTitle>Add wishlist item</DialogTitle>
          <DialogContent className="flex flex-col gap-4 pt-2!">
            <TextField name="name" label="Name" required />
            <TextField
              name="price"
              label="Price"
              type="number"
              required
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
            />
            <TextField
              select
              name="priority"
              label="Priority"
              defaultValue="medium"
            >
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </TextField>
            <TextField
              select
              name="status"
              label="Status"
              defaultValue="wanted"
            >
              <MenuItem value="wanted">Wanted</MenuItem>
              <MenuItem value="saving">Saving for it</MenuItem>
              <MenuItem value="purchased">Purchased</MenuItem>
            </TextField>
            <TextField name="url" label="Link" type="url" />
            <TextField name="notes" label="Notes" multiline rows={2} />
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
