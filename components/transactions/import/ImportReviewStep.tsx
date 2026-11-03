"use client";
// ---React---
import { useId } from "react";

// ---UI Components---
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import SelectField from "@/components/ui/SelectField";

// ---Lib---
import { formatCurrency } from "@/lib/format";
import type { ImportChoice, ImportRow } from "@/lib/import/types";

// ---Types---
import type { Category } from "@/types/finance";

// One row of the file at a time: the user picks its category, or skips it
export default function ImportReviewStep({
  rows,
  position,
  categories,
  choices,
  onChoose,
  onSkip,
  onPrevious,
  onNext,
}: {
  rows: ImportRow[];
  position: number;
  // The user's expense categories
  categories: Category[];
  choices: Record<number, ImportChoice | undefined>;
  onChoose: (sourceRow: number, categoryId: string) => void;
  onSkip: (sourceRow: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const labelId = useId();
  const row = rows[position];
  const choice = choices[row.sourceRow];
  const last = position === rows.length - 1;
  const decided = Boolean(choice?.categoryId) || Boolean(choice?.skipped);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-sm text-neutral-400">
          <span>
            Row <span className="font-medium text-neutral-200">{position + 1}</span> of{" "}
            {rows.length}
          </span>
          <span className="text-xs text-neutral-500">Row {row.sourceRow} in your file</span>
        </div>
        <div
          role="progressbar"
          aria-label="Import progress"
          aria-valuemin={1}
          aria-valuemax={rows.length}
          aria-valuenow={position + 1}
          className="h-1.5 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${((position + 1) / rows.length) * 100}%` }}
          />
        </div>
      </div>

      <article
        aria-label={`Row ${position + 1}`}
        className="rounded-xl border border-white/10 bg-white/5 p-5"
      >
        <p className="text-lg font-semibold break-words">{row.description}</p>
        <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-neutral-400">Date</dt>
            <dd className="mt-0.5 font-medium">{row.date}</dd>
          </div>
          <div>
            <dt className="text-neutral-400">Amount</dt>
            <dd className="mt-0.5 font-medium">
              <bdi dir="ltr">{formatCurrency(row.amount)}</bdi>
            </dd>
          </div>
        </dl>
      </article>

      <FormField label="Category" labelId={labelId}>
        <SelectField
          labelId={labelId}
          placeholder="Choose a category"
          value={choice?.categoryId ?? ""}
          onChange={(categoryId) => onChoose(row.sourceRow, categoryId)}
          options={categories.map((category) => ({
            value: category.id,
            label: category.name,
          }))}
        />
      </FormField>

      {choice?.skipped ? (
        <p className="text-sm text-amber-400">
          Skipped: this row won&apos;t be imported. Choose a category to include it again.
        </p>
      ) : (
        <p className="text-xs text-neutral-500">
          Missing a category? Create it on the Categories page, then start the import again.
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={onPrevious} disabled={position === 0}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onSkip(row.sourceRow)}>
            Skip
          </Button>
          <Button onClick={onNext} disabled={!decided}>
            {last ? "Review" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
