// ---Next---
import Link from "next/link";

// ---UI Components---
import ProgressBar from "@/components/ui/ProgressBar";

// ---Lib---
import { formatCurrency, formatMonth } from "@/lib/format";

// ---Types---
import type { DashboardBudget } from "@/types/dashboard";
import type { Currency } from "@/types/finance";

// The Hebrew currency format carries right-to-left marks; isolating each amount keeps
// the sentences around it from being reordered
const Amount = ({ value, currency }: { value: number; currency: Currency }) => (
  <bdi dir="ltr">{formatCurrency(value, currency)}</bdi>
);

// This month's budgets at a glance: the monthly one, and every category that has one
export default function BudgetProgress({
  month,
  budget,
}: {
  month: string;
  budget: DashboardBudget;
}) {
  const { general, totalSpent, categories } = budget;
  const hasBudget = general !== null || categories.length > 0;

  return (
    <section
      aria-labelledby="budget-progress-heading"
      className="mt-6 rounded-xl border border-white/10 bg-neutral-900 p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="budget-progress-heading" className="font-semibold">
          Budget progress
        </h2>
        {hasBudget && (
          <Link href="/budget" className="text-sm text-emerald-400 hover:underline">
            Manage budgets
          </Link>
        )}
      </div>

      {!hasBudget && (
        <p className="text-sm text-neutral-400">
          No budget set for {formatMonth(month)} yet.{" "}
          <Link href="/budget" className="text-emerald-400 hover:underline">
            Set one on the Budget page
          </Link>
          .
        </p>
      )}

      {general && (
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">Monthly budget</span>
            <span className="text-neutral-400">
              <Amount value={totalSpent} currency={general.currency} /> of{" "}
              <Amount value={general.limit} currency={general.currency} />
            </span>
          </div>
          <ProgressBar
            label="Monthly budget used"
            value={totalSpent}
            max={general.limit}
          />
          <p
            className={`mt-1.5 text-xs ${general.remaining < 0 ? "text-red-400" : "text-neutral-400"}`}
          >
            {general.remaining < 0 ? (
              <>
                Over the monthly budget by{" "}
                <Amount
                  value={Math.abs(general.remaining)}
                  currency={general.currency}
                />
              </>
            ) : (
              <>
                <Amount value={general.remaining} currency={general.currency} />{" "}
                left to spend
              </>
            )}
          </p>
        </div>
      )}

      {categories.length > 0 && (
        <div className={general ? "mt-6" : undefined}>
          <h3 className="mb-3 text-sm text-neutral-400">By category</h3>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            {categories.map((row) => (
              <li key={row.categoryId} aria-label={row.name}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="truncate">{row.name}</span>
                  </span>
                  <span className="shrink-0 text-neutral-400">
                    <Amount value={row.spent} currency={row.currency} />
                    {" / "}
                    <Amount value={row.limit} currency={row.currency} />
                  </span>
                </div>
                <ProgressBar
                  label={`${row.name} budget used`}
                  value={row.spent}
                  max={row.limit}
                />
                {row.spent > row.limit && (
                  <p className="mt-1 text-xs text-red-400">
                    Over budget by{" "}
                    <Amount
                      value={row.spent - row.limit}
                      currency={row.currency}
                    />
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
