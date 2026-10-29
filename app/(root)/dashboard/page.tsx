import PageHeader from "@/components/layout/PageHeader";
import MonthlyOverviewChart from "@/components/dashboard/MonthlyOverviewChart";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import SpendingByCategoryChart from "@/components/dashboard/SpendingByCategoryChart";
import SummaryCard from "@/components/dashboard/SummaryCard";
import { CURRENT_MONTH } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import {
  categories,
  savingsGoals,
  transactions,
} from "@/lib/mock-data";

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

export default function DashboardPage() {
  const monthTransactions = transactions.filter((t) =>
    t.date.startsWith(CURRENT_MONTH),
  );
  const income = sum(
    monthTransactions.filter((t) => t.type === "income").map((t) => t.amount),
  );
  const spending = sum(
    monthTransactions.filter((t) => t.type === "expense").map((t) => t.amount),
  );
  const totalSaved = sum(savingsGoals.map((g) => g.currentAmount));
  const balance =
    sum(transactions.filter((t) => t.type === "income").map((t) => t.amount)) -
    sum(transactions.filter((t) => t.type === "expense").map((t) => t.amount));

  const spendingByCategory = categories
    .filter((c) => c.type === "expense")
    .map((c) => ({
      id: c.id,
      label: c.name,
      color: c.color,
      value: sum(
        monthTransactions
          .filter((t) => t.categoryId === c.id)
          .map((t) => t.amount),
      ),
    }))
    .filter((slice) => slice.value > 0);

  const months = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort();
  const monthlyTotals = months.map((month) => {
    const inMonth = transactions.filter((t) => t.date.startsWith(month));
    return {
      month,
      income: sum(inMonth.filter((t) => t.type === "income").map((t) => t.amount)),
      expenses: sum(inMonth.filter((t) => t.type === "expense").map((t) => t.amount)),
    };
  });

  const recent = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your balance, income and spending"
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Balance" value={formatCurrency(balance)} />
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
        <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
          <h2 className="mb-2 font-semibold">Spending by category</h2>
          <SpendingByCategoryChart data={spendingByCategory} />
        </div>
        <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
          <h2 className="mb-2 font-semibold">Income vs. expenses</h2>
          <MonthlyOverviewChart data={monthlyTotals} />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-white/10 bg-neutral-900 p-5">
        <h2 className="mb-2 font-semibold">Recent transactions</h2>
        <RecentTransactions transactions={recent} categories={categories} />
      </section>
    </>
  );
}
