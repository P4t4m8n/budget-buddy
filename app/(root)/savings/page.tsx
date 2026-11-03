import { Suspense } from "react";
import SummaryCard from "@/components/dashboard/SummaryCard";
import PageHeader from "@/components/layout/PageHeader";
import GoalDialog from "@/components/savings/GoalDialog";
import InvestmentHistoryChart from "@/components/savings/InvestmentHistoryChart";
import InvestmentsChart from "@/components/savings/InvestmentsChart";
import InvestmentsTable from "@/components/savings/InvestmentsTable";
import SavingsGoalCard from "@/components/savings/SavingsGoalCard";
import { getInvestmentsOverview } from "@/lib/data/investments";
import { getSavingsOverview } from "@/lib/data/savings";
import { formatCurrency } from "@/lib/format";

const panel = "rounded-xl border border-white/10 bg-neutral-900 p-5";

async function SavingsContent() {
  const [
    { goals, totalSaved },
    { investments, totalInvested, portfolioValue, gain, history },
  ] = await Promise.all([getSavingsOverview(), getInvestmentsOverview()]);

  const skeleton = <div className="h-80 animate-pulse rounded-lg bg-white/5" />;

  return (
    <>
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

      <div className="mt-8 mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Savings goals</h2>
        <GoalDialog />
      </div>
      {goals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-neutral-400">
          No savings goals yet. Add one to start tracking what you put aside.
        </p>
      ) : (
        <section className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => (
            <SavingsGoalCard key={goal.id} goal={goal} />
          ))}
        </section>
      )}

      <h2 className="mt-8 mb-4 text-lg font-semibold">Investments</h2>
      <div className={panel}>
        <Suspense fallback={skeleton}>
          <InvestmentsTable rows={investments} />
        </Suspense>
      </div>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className={panel}>
          <h3 className="mb-2 font-semibold">Invested vs. current value</h3>
          {investments.length > 0 ? (
            <Suspense fallback={skeleton}>
              <InvestmentsChart rows={investments} />
            </Suspense>
          ) : (
            <p className="flex h-80 items-center justify-center text-center text-sm text-neutral-400">
              Add an investment to compare what you put in with what it is worth.
            </p>
          )}
        </div>
        <div className={panel}>
          <h3 className="mb-2 font-semibold">Investment value over time</h3>
          {history.series.length > 0 ? (
            <Suspense fallback={skeleton}>
              <InvestmentHistoryChart history={history} />
            </Suspense>
          ) : (
            <p className="flex h-80 items-center justify-center text-center text-sm text-neutral-400">
              Update an investment&apos;s value to build its history.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

export default function SavingsPage() {
  return (
    <>
      <PageHeader
        title="Savings & Investments"
        description="Track your savings goals and investments"
      />
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-neutral-900" />}
      >
        <SavingsContent />
      </Suspense>
    </>
  );
}
