"use client";
// ---React---
import { useMemo, useState, useTransition } from "react";

// ---Actions---
import { importTransactionsAction } from "@/actions/transactions";

// ---Components---
import ImportFileStep from "./ImportFileStep";
import ImportMappingStep from "./ImportMappingStep";
import ImportReviewStep from "./ImportReviewStep";
import ImportSummaryStep from "./ImportSummaryStep";

// ---UI Components---
import Button from "@/components/ui/Button";

// ---Lib---
import { summarizeImport } from "@/lib/import/summary";
import { detectMapping, findHeaderRow } from "@/lib/import/table";
import type {
  ColumnMapping,
  ImportChoice,
  ImportRow,
  Table,
} from "@/lib/import/types";

// ---Types---
import type { Category } from "@/types/finance";

type Stage = "file" | "map" | "review" | "summary" | "done";

const STEPS: Record<Stage, { number: number; label: string }> = {
  file: { number: 1, label: "Choose a file" },
  map: { number: 2, label: "Match the columns" },
  review: { number: 3, label: "Choose a category for each row" },
  summary: { number: 4, label: "Check and import" },
  done: { number: 4, label: "Done" },
};

const nothing: ColumnMapping = { date: null, description: null, amount: null };

// Everything about one import lives here and is thrown away when the dialog closes. Nothing
// reaches the server until the very end, when the user confirms.
export default function ImportFlow({
  categories,
  titleId,
  onClose,
  onBusyChange,
  onStale,
}: {
  // The user's expense categories
  categories: Category[];
  titleId: string;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
  onStale: () => void;
}) {
  const [stage, setStage] = useState<Stage>("file");
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<Table>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>(nothing);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [choices, setChoices] = useState<Record<number, ImportChoice | undefined>>({});
  const [position, setPosition] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [importing, startImport] = useTransition();

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const summary = useMemo(
    () => summarizeImport(rows, choices, categoryNames),
    [rows, choices, categoryNames],
  );

  function fileLoaded(name: string, loaded: Table) {
    const header = findHeaderRow(loaded) ?? 0;
    setFileName(name);
    setTable(loaded);
    setHeaderRow(header);
    setMapping(detectMapping(loaded, header));
    setStage("map");
  }

  function changeHeaderRow(next: number) {
    setHeaderRow(next);
    setMapping(detectMapping(table, next));
  }

  function startReview(readRows: ImportRow[]) {
    setRows(readRows);
    setChoices({});
    setPosition(0);
    setStage("review");
  }

  function choose(sourceRow: number, categoryId: string) {
    setChoices((current) => ({ ...current, [sourceRow]: { categoryId, skipped: false } }));
  }

  function skip(sourceRow: number) {
    setChoices((current) => ({
      ...current,
      [sourceRow]: { categoryId: current[sourceRow]?.categoryId ?? null, skipped: true },
    }));
    next();
  }

  function next() {
    if (position < rows.length - 1) setPosition(position + 1);
    else setStage("summary");
  }

  function runImport() {
    setError(null);
    onBusyChange(true);

    startImport(async () => {
      const result = await importTransactionsAction(
        summary.entries.map(({ description, amount, date, categoryId }) => ({
          description,
          amount,
          date,
          categoryId,
        })),
      );
      onBusyChange(false);

      if (result.ok) {
        setImportedCount(result.count);
        setStage("done");
      } else {
        // A category was deleted elsewhere: the list of categories is refreshed on close
        if (result.error.code === "INVALID_REFERENCE") onStale();
        setError(result.error.message);
      }
    });
  }

  const step = STEPS[stage];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h2 id={titleId} className="text-lg font-semibold">
          Import transactions
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Step {step.number} of 4 · {step.label}
        </p>
      </div>

      {stage === "file" && <ImportFileStep onLoaded={fileLoaded} onCancel={onClose} />}

      {stage === "map" && (
        <ImportMappingStep
          fileName={fileName}
          table={table}
          headerRow={headerRow}
          mapping={mapping}
          onHeaderRowChange={changeHeaderRow}
          onMappingChange={setMapping}
          onBack={() => setStage("file")}
          onContinue={(readRows) => startReview(readRows)}
        />
      )}

      {stage === "review" && rows[position] && (
        <ImportReviewStep
          rows={rows}
          position={position}
          categories={categories}
          choices={choices}
          onChoose={choose}
          onSkip={skip}
          onPrevious={() => setPosition(Math.max(position - 1, 0))}
          onNext={next}
        />
      )}

      {stage === "summary" && (
        <ImportSummaryStep
          summary={summary}
          importing={importing}
          error={error}
          onBack={() => {
            setError(null);
            setStage("review");
          }}
          onImport={runImport}
        />
      )}

      {stage === "done" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-300">
            Imported <span className="font-medium">{importedCount}</span>{" "}
            {importedCount === 1 ? "transaction" : "transactions"}.
          </p>
          <div className="mt-2 flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}
