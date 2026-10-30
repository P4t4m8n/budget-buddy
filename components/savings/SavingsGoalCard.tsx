// ---Components---
import DeleteDepositButton from "./DeleteDepositButton";
import DeleteGoalButton from "./DeleteGoalButton";
import DepositDialog from "./DepositDialog";
import GoalDialog from "./GoalDialog";

// ---Lib---
import { formatCurrency } from "@/lib/format";

// ---Types---
import type { SavingsGoalProgress } from "@/types/savings";

const Amount = ({ value, goal }: { value: number; goal: SavingsGoalProgress }) => (
  // The Hebrew currency format carries right-to-left marks; isolating each amount keeps
  // "saved of target" from being reordered around them
  <bdi dir="ltr">{formatCurrency(value, goal.currency)}</bdi>
);

export default function SavingsGoalCard({
  goal,
}: {
  goal: SavingsGoalProgress;
}) {
  const percent = Math.min(goal.currentAmount / goal.targetAmount, 1) * 100;
  const { deposits } = goal;

  return (
    <article
      aria-label={goal.name}
      className="flex flex-col rounded-xl border border-white/10 bg-neutral-900 p-5"
    >
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 font-semibold break-words">{goal.name}</h3>
          <span className="shrink-0 text-sm font-medium text-emerald-400">
            {Math.round(percent)}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`${goal.name} saved`}
          aria-valuemin={0}
          aria-valuemax={goal.targetAmount}
          aria-valuenow={Math.min(goal.currentAmount, goal.targetAmount)}
          className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-neutral-400">
          <Amount value={goal.currentAmount} goal={goal} /> of{" "}
          <Amount value={goal.targetAmount} goal={goal} />
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {goal.targetDate ? `Target date: ${goal.targetDate}` : "No target date"}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-white/5 pt-3">
        <DepositDialog goal={goal} />
        <GoalDialog goal={goal} />
        <DeleteGoalButton goal={goal} />
      </div>

      {deposits.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-500">No deposits yet</p>
      ) : (
        <details className="group mt-3">
          <summary className="cursor-pointer text-xs font-medium text-neutral-400 hover:text-neutral-200">
            History ({deposits.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {deposits.map((deposit) => (
              <li
                key={deposit.id}
                className="rounded-lg bg-white/5 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="whitespace-nowrap text-neutral-400">
                    {deposit.date}
                  </span>
                  <span
                    className={`font-medium whitespace-nowrap ${deposit.amount < 0 ? "text-red-400" : "text-emerald-400"}`}
                  >
                    {deposit.amount < 0 ? "−" : "+"}
                    <Amount value={Math.abs(deposit.amount)} goal={goal} />
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="min-w-0 text-xs break-words text-neutral-500">
                    {deposit.note}
                  </span>
                  <span className="flex shrink-0 items-center">
                    <DepositDialog goal={goal} deposit={deposit} />
                    <DeleteDepositButton goal={goal} deposit={deposit} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
