"use client";
// ---React---
import { useState } from "react";

// ---UI Components---
import Button from "@/components/ui/Button";
import FormAlert from "@/components/ui/FormAlert";
import FormField, { inputClass } from "@/components/ui/FormField";

// ---Lib---
import { ImportFileError, readTableFromFile } from "@/lib/import/spreadsheet";
import { MAX_FILE_BYTES, MAX_IMPORT_ROWS, type Table } from "@/lib/import/types";

export default function ImportFileStep({
  onLoaded,
  onCancel,
}: {
  onLoaded: (fileName: string, table: Table) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  async function readFile(file: File) {
    setError(null);
    setReading(true);
    try {
      onLoaded(file.name, await readTableFromFile(file));
    } catch (failure) {
      setError(
        failure instanceof ImportFileError
          ? failure.message
          : "That file couldn't be read.",
      );
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-400">
        Choose an .xlsx or .csv file, such as a statement from your bank. You will
        pick a category for each row, one at a time, and nothing is saved until you
        confirm at the end.
      </p>

      {error && <FormAlert>{error}</FormAlert>}

      <FormField label="Spreadsheet file">
        <input
          type="file"
          accept=".xlsx,.csv"
          disabled={reading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // So the same file can be chosen again after fixing it
            event.target.value = "";
            if (file) void readFile(file);
          }}
          className={`${inputClass} cursor-pointer file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-neutral-200`}
        />
      </FormField>

      <p className="text-xs text-neutral-500">
        {reading
          ? "Reading the file…"
          : `Up to ${MAX_FILE_BYTES / 1024 / 1024} MB and ${MAX_IMPORT_ROWS} rows at a time. The file is read in your browser: only the rows you confirm are sent. Every row is imported as an expense in ILS.`}
      </p>

      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
