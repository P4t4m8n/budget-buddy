import { Suspense } from "react";
import BudgetProgressList from "@/components/budget/BudgetProgressList";
import BudgetVsSpentChart from "@/components/budget/BudgetVsSpentChart";
import SummaryCard from "@/components/dashboard/SummaryCard";
import PageHeader from "@/components/layout/PageHeader";
import { CURRENT_MONTH } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { budgets, categories, transactions } from "@/lib/mock-data";

export default function BudgetPage() {
  const rows = budgets
    .filter((b) => b.month === CURRENT_MONTH)
    .map((b) => {
      const category = categories.find((c) => c.id === b.categoryId);
      const spent = transactions
        .filter(
          (t) =>
            t.type === "expense" &&
            t.categoryId === b.categoryId &&
            t.date.startsWith(CURRENT_MONTH),
        )
        .reduce((total, t) => total + t.amount, 0);

      return {
        categoryId: b.categoryId,
        name: category?.name ?? "Unknown",
        color: category?.color ?? "#737373",
        limit: b.limit,
        spent,
      };
    });

  const totalBudget = rows.reduce((total, r) => total + r.limit, 0);
  const totalSpent = rows.reduce((total, r) => total + r.spent, 0);
  const remaining = totalBudget - totalSpent;

  return (
    <>
      <PageHeader
        title="Budget"
        description="Plan your monthly budget per category"
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Total budget" value={formatCurrency(totalBudget)} />
        <SummaryCard
          label="Spent"
          value={formatCurrency(totalSpent)}
          tone="negative"
        />
        <SummaryCard
          label="Remaining"
          value={formatCurrency(remaining)}
          tone={remaining >= 0 ? "positive" : "negative"}
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
          <h2 className="mb-4 font-semibold">Progress by category</h2>
          <BudgetProgressList rows={rows} />
        </div>
        <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
          <h2 className="mb-2 font-semibold">Budget vs. spent</h2>
          <Suspense
            fallback={<div className="h-80 animate-pulse rounded-lg bg-white/5" />}
          >
            <BudgetVsSpentChart rows={rows} />
          </Suspense>
        </div>
      </section>
    </>
  );
}
