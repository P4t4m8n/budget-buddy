"use client";
// ---React---
import { useId, useMemo } from "react";

// ---UI Components---
import Button from "@/components/ui/Button";
import FormAlert from "@/components/ui/FormAlert";
import FormField from "@/components/ui/FormField";
import SelectField from "@/components/ui/SelectField";

// ---Lib---
import { formatCurrency } from "@/lib/format";
import { buildRows, columnLabels, isMappingComplete } from "@/lib/import/table";
import {
  MAX_IMPORT_ROWS,
  type Cell,
  type ColumnMapping,
  type ImportRow,
  type SkippedRow,
  type Table,
} from "@/lib/import/types";

const PREVIEW_ROWS = 5;
const HEADER_CHOICES = 30;
const SKIPPED_SHOWN = 8;

const preview = (row: Cell[]) => {
  const text = row
    .filter((cell) => cell !== null && cell !== undefined)
    .map((cell) => (cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell)))
    .join(" · ");
  return text.length > 60 ? `${text.slice(0, 60)}…` : text || "(empty)";
};

const FIELD_LABELS: { field: keyof ColumnMapping; label: string }[] = [
  { field: "date", label: "Date" },
  { field: "description", label: "Description" },
  { field: "amount", label: "Amount" },
];

// Match the file's columns to what a transaction needs. The columns are guessed from the
// headers and contents; this is where the user corrects them.
export default function ImportMappingStep({
  fileName,
  table,
  headerRow,
  mapping,
  onHeaderRowChange,
  onMappingChange,
  onBack,
  onContinue,
}: {
  fileName: string;
  table: Table;
  headerRow: number;
  mapping: ColumnMapping;
  onHeaderRowChange: (headerRow: number) => void;
  onMappingChange: (mapping: ColumnMapping) => void;
  onBack: () => void;
  onContinue: (rows: ImportRow[], skipped: SkippedRow[]) => void;
}) {
  const id = useId();
  const labels = useMemo(() => columnLabels(table, headerRow), [table, headerRow]);
  const { rows, skipped } = useMemo(
    () => buildRows(table, headerRow, mapping),
    [table, headerRow, mapping],
  );

  const complete = isMappingComplete(mapping);
  const tooMany = rows.length > MAX_IMPORT_ROWS;
  const canContinue = complete && rows.length > 0 && !tooMany;

  const columnOptions = labels.map((label, index) => ({ value: String(index), label }));
  const headerOptions = table.slice(0, HEADER_CHOICES).map((row, index) => ({
    value: String(index),
    label: `Row ${index + 1}: ${preview(row)}`,
  }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-400">
        <span className="font-medium text-neutral-200">{fileName}</span>. Check which
        column is which. Every row is imported as an expense, so the sign of the
        amount doesn&apos;t matter. If your file has separate debit and credit
        columns, choose the debit one.
      </p>

      <FormField label="Row with the column names" labelId={`${id}-header`}>
        <SelectField
          labelId={`${id}-header`}
          value={String(headerRow)}
          onChange={(value) => onHeaderRowChange(Number(value))}
          options={headerOptions}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {FIELD_LABELS.map(({ field, label }) => (
          <FormField key={field} label={label} labelId={`${id}-${field}`}>
            <SelectField
              labelId={`${id}-${field}`}
              placeholder="Choose a column"
              value={mapping[field] === null ? "" : String(mapping[field])}
              onChange={(value) =>
                onMappingChange({ ...mapping, [field]: value === "" ? null : Number(value) })
              }
              options={columnOptions}
            />
          </FormField>
        ))}
      </div>

      {!complete && (
        <FormAlert>Choose a column for the date, the description and the amount.</FormAlert>
      )}
      {complete && rows.length === 0 && (
        <FormAlert>No rows could be read with these columns. Try different ones.</FormAlert>
      )}
      {tooMany && (
        <FormAlert>
          This file has {rows.length} rows. Import up to {MAX_IMPORT_ROWS} at a time:
          split the file and import it in parts.
        </FormAlert>
      )}

      {complete && rows.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-neutral-300">
            <span className="font-medium">{rows.length}</span>{" "}
            {rows.length === 1 ? "row" : "rows"} can be imported
            {skipped.length > 0 && (
              <>
                , <span className="font-medium">{skipped.length}</span> will be skipped
              </>
            )}
            . The first {Math.min(PREVIEW_ROWS, rows.length)}:
          </p>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs text-neutral-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, PREVIEW_ROWS).map((row) => (
                  <tr key={row.sourceRow} className="border-t border-white/5">
                    <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
                    <td className="px-3 py-2">{row.description}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <bdi dir="ltr">{formatCurrency(row.amount)}</bdi>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {skipped.length > 0 && (
        <details className="text-sm text-neutral-400">
          <summary className="cursor-pointer hover:text-neutral-200">
            Rows that will be skipped ({skipped.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {skipped.slice(0, SKIPPED_SHOWN).map((row) => (
              <li key={row.sourceRow}>
                Row {row.sourceRow}: {row.reason}
              </li>
            ))}
            {skipped.length > SKIPPED_SHOWN && (
              <li>…and {skipped.length - SKIPPED_SHOWN} more</li>
            )}
          </ul>
        </details>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={onBack}>
          Choose another file
        </Button>
        <Button disabled={!canContinue} onClick={() => onContinue(rows, skipped)}>
          Continue
        </Button>
      </div>
    </div>
  );
}
