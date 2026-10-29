import type { SavingsGoal } from "@/types/finance";

export const savingsGoals: SavingsGoal[] = [
  { id: "s-001", name: "Emergency fund", targetAmount: 20000, currency: "ILS", targetDate: "2027-06-30" },
  { id: "s-002", name: "Vacation in Japan", targetAmount: 6000, currency: "ILS", targetDate: "2027-04-01" },
  { id: "s-003", name: "New car down payment", targetAmount: 15000, currency: "ILS", targetDate: "2028-01-01" },
  { id: "s-004", name: "Home renovation", targetAmount: 10000, currency: "ILS", targetDate: null },
];
