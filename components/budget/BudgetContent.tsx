import Link from "next/link";

import { getBudgetOverview } from "@/lib/data/budgets";
import { formatCurrency, formatMonth } from "@/lib/format";

import MonthNav from "./MonthNav";
import GeneralBudgetCard from "./GeneralBudgetCard";
import SummaryCard from "../dashboard/SummaryCard";
import BudgetProgressList from "./BudgetProgressList";
import BudgetVsSpentChart from "./BudgetVsSpentChart";

const panel = "rounded-xl border border-white/10 bg-neutral-900 p-5";

interface BudgetContentProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BudgetContent({
  searchParams,
}: BudgetContentProps) {
  const { month: requested } = await searchParams;
  const {
    month,
    thisMonth,
    rows,
    totalBudget,
    budgetedSpent,
    unbudgetedSpent,
    totalSpent,
    general,
  } = await getBudgetOverview({
    month: typeof requested === "string" ? requested : undefined,
  });

  const budgeted = rows.flatMap((row) =>
    row.limit === null
      ? []
      : [{ name: row.name, limit: row.limit, spent: row.spent }],
  );
  const remaining = totalBudget - budgetedSpent;

  return (
    <>
      <MonthNav month={month} thisMonth={thisMonth} />

      <GeneralBudgetCard
        general={general}
        month={month}
        totalSpent={totalSpent}
        allocated={totalBudget}
      />

      <h2 className="mb-4 text-lg font-semibold">Category budgets</h2>
      {rows.length === 0 ? (
        <CreateBudgetLink />
      ) : (
        <>
          <SummeryCardSection
            totalBudget={totalBudget}
            budgetedSpent={budgetedSpent}
            remaining={remaining}
          />
          {unbudgetedSpent > 0 && (
            <p className="mt-3 text-sm text-neutral-400">
              Plus {formatCurrency(unbudgetedSpent)} spent in categories without
              a budget.
            </p>
          )}
          {budgeted.length === 0 && (
            <p className="mt-3 text-sm text-neutral-400">
              No budgets for {formatMonth(month)} yet. Set a limit for any
              category below.
            </p>
          )}

          <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className={panel}>
              <h2 className="mb-4 font-semibold">Progress by category</h2>
              <BudgetProgressList rows={rows} month={month} />
            </div>
            <div className={panel}>
              <h2 className="mb-2 font-semibold">Budget vs. spent</h2>
              {budgeted.length > 0 ? (
                <BudgetVsSpentChart rows={budgeted} />
              ) : (
                <p className="flex h-80 items-center justify-center text-center text-sm text-neutral-400">
                  Set a budget to compare it with your spending.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}

const CreateBudgetLink = () => {
  return (
    <p className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-neutral-400">
      Budgets are set per expense category.{" "}
      <Link href="/categories" className="text-emerald-400 hover:underline">
        Create an expense category
      </Link>{" "}
      to start planning.
    </p>
  );
};

interface SummeryCardSectionProps {
  totalBudget: number;
  budgetedSpent: number;
  remaining: number;
}
const SummeryCardSection = ({
  totalBudget,
  budgetedSpent,
  remaining,
}: SummeryCardSectionProps) => {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SummaryCard label="Total budget" value={formatCurrency(totalBudget)} />
      <SummaryCard
        label="Spent"
        value={formatCurrency(budgetedSpent)}
        tone="negative"
      />
      <SummaryCard
        label="Remaining"
        value={formatCurrency(remaining)}
        tone={remaining >= 0 ? "positive" : "negative"}
      />
    </section>
  );
};
