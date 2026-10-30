import type { SavingsDeposit, SavingsGoal } from "@/types/finance";

// currentAmount isn't stored; it's the sum of the goal's SavingsDeposit rows
export type SavingsGoalProgress = SavingsGoal & {
  currentAmount: number;
  // Newest first; withdrawals are negative
  deposits: SavingsDeposit[];
};

export type SavingsOverview = {
  goals: SavingsGoalProgress[];
  // Every goal's balance added up (ILS only until currency conversion exists)
  totalSaved: number;
};
