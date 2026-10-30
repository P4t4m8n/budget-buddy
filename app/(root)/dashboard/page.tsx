import { Suspense } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import MonthlyOverviewChart from "@/components/dashboard/MonthlyOverviewChart";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import SpendingByCategoryChart from "@/components/dashboard/SpendingByCategoryChart";
import SummaryCard from "@/components/dashboard/SummaryCard";
import { getDashboard } from "@/lib/data/dashboard";
import { formatCurrency, formatMonth } from "@/lib/format";

const panel = "rounded-xl border border-white/10 bg-neutral-900 p-5";

const EmptyChart = ({ children }: { children: React.ReactNode }) => (
  <p className="flex h-70 items-center justify-center text-center text-sm text-neutral-400">
    {children}
  </p>
);

async function DashboardContent() {
  const {
    month,
    balance,
    totalSaved,
    income,
    spending,
    spendingByCategory,
    monthlyTotals,
    recent,
  } = await getDashboard();

  const hasActivity = monthlyTotals.some((m) => m.income > 0 || m.expenses > 0);

  return (
    <>
      <p className="mb-4 text-sm text-neutral-400">
        This month: {formatMonth(month)}
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Balance"
          value={formatCurrency(balance)}
          tone={balance < 0 ? "negative" : "neutral"}
        />
        <SummaryCard
          label="Income this month"
          value={formatCurrency(income)}
          tone="positive"
        />
        <SummaryCard
          label="Spending this month"
          value={formatCurrency(spending)}
          tone="negative"
        />
        <SummaryCard label="Total saved" value={formatCurrency(totalSaved)} />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className={panel}>
          <h2 className="mb-2 font-semibold">Spending by category</h2>
          {spendingByCategory.length > 0 ? (
            <SpendingByCategoryChart data={spendingByCategory} />
          ) : (
            <EmptyChart>No spending recorded this month.</EmptyChart>
          )}
        </div>
        <div className={panel}>
          <h2 className="mb-2 font-semibold">Income vs. expenses</h2>
          {hasActivity ? (
            <MonthlyOverviewChart data={monthlyTotals} />
          ) : (
            <EmptyChart>
              <span>
                Nothing in the last {monthlyTotals.length} months yet.{" "}
                <Link
                  href="/transactions"
                  className="text-emerald-400 hover:underline"
                >
                  Add a transaction
                </Link>{" "}
                to see it here.
              </span>
            </EmptyChart>
          )}
        </div>
      </section>

      <section className={`mt-6 ${panel}`}>
        <h2 className="mb-2 font-semibold">Recent transactions</h2>
        <RecentTransactions transactions={recent} />
      </section>
    </>
  );
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your balance, income and spending"
      />
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-neutral-900" />}
      >
        <DashboardContent />
      </Suspense>
    </>
  );
}
