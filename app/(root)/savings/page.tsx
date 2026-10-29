import { Suspense } from "react";
import SummaryCard from "@/components/dashboard/SummaryCard";
import PageHeader from "@/components/layout/PageHeader";
import InvestmentsChart from "@/components/savings/InvestmentsChart";
import InvestmentsTable from "@/components/savings/InvestmentsTable";
import SavingsGoalCard from "@/components/savings/SavingsGoalCard";
import { formatCurrency } from "@/lib/format";
import { investments, savingsGoals } from "@/lib/mock-data";

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

export default function SavingsPage() {
  const rows = investments.map((i) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    ticker: i.ticker ?? "-",
    amountInvested: i.amountInvested,
    currentValue: i.currentValue,
    gainPercent: ((i.currentValue - i.amountInvested) / i.amountInvested) * 100,
  }));

  const totalSaved = sum(savingsGoals.map((g) => g.currentAmount));
  const totalInvested = sum(rows.map((r) => r.amountInvested));
  const portfolioValue = sum(rows.map((r) => r.currentValue));
  const gain = portfolioValue - totalInvested;

  const skeleton = <div className="h-80 animate-pulse rounded-lg bg-white/5" />;

  return (
    <>
      <PageHeader
        title="Savings & Investments"
        description="Track your savings goals and investments"
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total saved" value={formatCurrency(totalSaved)} />
        <SummaryCard label="Total invested" value={formatCurrency(totalInvested)} />
        <SummaryCard
          label="Portfolio value"
          value={formatCurrency(portfolioValue)}
        />
        <SummaryCard
          label="Total return"
          value={`${gain >= 0 ? "+" : "-"}${formatCurrency(Math.abs(gain))}`}
          tone={gain >= 0 ? "positive" : "negative"}
        />
      </section>

      <h2 className="mt-8 mb-4 text-lg font-semibold">Savings goals</h2>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {savingsGoals.map((goal) => (
          <SavingsGoalCard key={goal.id} goal={goal} />
        ))}
      </section>

      <h2 className="mt-8 mb-4 text-lg font-semibold">Investments</h2>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
          <Suspense fallback={skeleton}>
            <InvestmentsTable rows={rows} />
          </Suspense>
        </div>
        <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
          <h3 className="mb-2 font-semibold">Invested vs. current value</h3>
          <Suspense fallback={skeleton}>
            <InvestmentsChart rows={rows} />
          </Suspense>
        </div>
      </section>
    </>
  );
}
