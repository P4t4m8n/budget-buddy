import { formatCurrency } from "@/lib/format";
import type { SavingsGoal } from "@/types/finance";

export default function SavingsGoalCard({ goal }: { goal: SavingsGoal }) {
  const percent = Math.min(goal.currentAmount / goal.targetAmount, 1) * 100;

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{goal.name}</h3>
        <span className="text-sm font-medium text-emerald-400">
          {Math.round(percent)}%
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-neutral-400">
        {formatCurrency(goal.currentAmount)} of{" "}
        {formatCurrency(goal.targetAmount)}
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        {goal.targetDate ? `Target date: ${goal.targetDate}` : "No target date"}
      </p>
    </div>
  );
}
