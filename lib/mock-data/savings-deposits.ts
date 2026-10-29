import type { SavingsDeposit } from "@/types/finance";

const deposit = (
  id: string,
  goalId: string,
  date: string,
  amount: number,
): SavingsDeposit => ({ id, goalId, date, amount, note: null });

// Per goal these add up to what the goal card used to show as "current amount"
export const savingsDeposits: SavingsDeposit[] = [
  deposit("d-001", "s-001", "2026-06-01", 5000),
  deposit("d-002", "s-001", "2026-08-01", 4500),
  deposit("d-003", "s-001", "2026-10-01", 3000),
  deposit("d-004", "s-002", "2026-07-15", 1500),
  deposit("d-005", "s-002", "2026-10-05", 800),
  deposit("d-006", "s-003", "2026-05-20", 2000),
  deposit("d-007", "s-003", "2026-09-20", 1800),
  deposit("d-008", "s-004", "2026-10-10", 900),
];
