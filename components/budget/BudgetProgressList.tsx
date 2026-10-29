import { formatCurrency } from "@/lib/format";

import type { Currency } from "@/types/finance";

export type BudgetRow = {
  categoryId: string;
  name: string;
  color: string;
  limit: number;
  spent: number;
  currency: Currency;
};

export default function BudgetProgressList({ rows }: { rows: BudgetRow[] }) {
  return (
    <ul className="space-y-5">
      {rows.map((row) => {
        const ratio = row.spent / row.limit;
        const barColor =
          ratio > 1
            ? "bg-red-500"
            : ratio >= 0.8
              ? "bg-amber-500"
              : "bg-emerald-500";

        return (
          <li key={row.categoryId}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                {row.name}
              </span>
              <span className="text-neutral-400">
                {formatCurrency(row.spent, row.currency)} /{" "}
                {formatCurrency(row.limit, row.currency)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${Math.min(ratio, 1) * 100}%` }}
              />
            </div>
            {ratio > 1 && (
              <p className="mt-1 text-xs text-red-400">
                Over budget by {formatCurrency(row.spent - row.limit, row.currency)}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
