// ---Lib---
import { formatCurrency } from "@/lib/format";

// ---Components---
import BudgetDialog from "./BudgetDialog";
import DeleteBudgetButton from "./DeleteBudgetButton";

// ---Types---
import type { BudgetRow } from "@/types/budget";
import type { Currency } from "@/types/finance";

const barColor = (ratio: number) =>
  ratio > 1 ? "bg-red-500" : ratio >= 0.8 ? "bg-amber-500" : "bg-emerald-500";

// The Hebrew currency format carries right-to-left marks; isolating each amount keeps
// "spent / limit" from being reordered around them
const Amount = ({ value, currency }: { value: number; currency: Currency }) => (
  <bdi dir="ltr">{formatCurrency(value, currency)}</bdi>
);

export default function BudgetProgressList({
  rows,
  month,
}: {
  rows: BudgetRow[];
  month: string;
}) {
  return (
    <ul className="space-y-5">
      {rows.map((row) => {
        const { limit } = row;
        const ratio = limit === null ? 0 : row.spent / limit;

        return (
          <li key={row.categoryId} aria-label={row.name}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="truncate">{row.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="mr-2 text-neutral-400">
                  {limit === null ? (
                    row.spent > 0 ? (
                      <>
                        <Amount value={row.spent} currency={row.currency} />{" "}
                        spent · no budget
                      </>
                    ) : (
                      "No budget"
                    )
                  ) : (
                    <>
                      <Amount value={row.spent} currency={row.currency} />
                      {" / "}
                      <Amount value={limit} currency={row.currency} />
                    </>
                  )}
                </span>
                <BudgetDialog row={row} month={month} />
                {row.budgetId !== null && (
                  <DeleteBudgetButton row={row} month={month} />
                )}
              </span>
            </div>
            {limit !== null && (
              <>
                <div
                  role="progressbar"
                  aria-label={`${row.name} budget used`}
                  aria-valuemin={0}
                  aria-valuemax={limit}
                  aria-valuenow={Math.min(row.spent, limit)}
                  className="h-2 overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className={`h-full rounded-full ${barColor(ratio)}`}
                    style={{ width: `${Math.min(ratio, 1) * 100}%` }}
                  />
                </div>
                {ratio > 1 && (
                  <p className="mt-1 text-xs text-red-400">
                    Over budget by{" "}
                    <Amount
                      value={row.spent - limit}
                      currency={row.currency}
                    />
                  </p>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
