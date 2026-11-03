"use client";
// ---UI Components---
import Button from "@/components/ui/Button";
import FormAlert from "@/components/ui/FormAlert";

// ---Lib---
import { formatCurrency } from "@/lib/format";
import type { ImportSummary } from "@/lib/import/summary";

// What is about to be added, before anything is saved
export default function ImportSummaryStep({
  summary,
  importing,
  error,
  onBack,
  onImport,
}: {
  summary: ImportSummary;
  importing: boolean;
  error: string | null;
  onBack: () => void;
  onImport: () => void;
}) {
  const { entries, leftOut, byCategory, total } = summary;

  return (
    <div className="flex flex-col gap-4">
      {error && <FormAlert>{error}</FormAlert>}

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-300">
          No rows are set to be imported. Go back and choose a category for at least
          one row.
        </p>
      ) : (
        <>
          <p className="text-sm text-neutral-300">
            <span className="font-medium">{entries.length}</span>{" "}
            {entries.length === 1 ? "transaction" : "transactions"} will be added,
            <bdi dir="ltr" className="mx-1 font-medium">
              {formatCurrency(total)}
            </bdi>
            in total
            {leftOut > 0 && (
              <>
                ; <span className="font-medium">{leftOut}</span>{" "}
                {leftOut === 1 ? "row was" : "rows were"} skipped
              </>
            )}
            .
          </p>

          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs text-neutral-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 text-right font-medium">Transactions</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((category) => (
                  <tr key={category.categoryId} className="border-t border-white/5">
                    <td className="px-3 py-2">{category.name}</td>
                    <td className="px-3 py-2 text-right">{category.count}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <bdi dir="ltr">{formatCurrency(category.total)}</bdi>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={onBack} disabled={importing}>
          Back to review
        </Button>
        <Button onClick={onImport} disabled={importing || entries.length === 0}>
          {importing
            ? "Importing…"
            : `Import ${entries.length} ${entries.length === 1 ? "transaction" : "transactions"}`}
        </Button>
      </div>
    </div>
  );
}
