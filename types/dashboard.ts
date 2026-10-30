import type { Transaction } from "@/types/finance";

export type SpendingSlice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export type MonthlyTotals = {
  month: string; // "YYYY-MM"
  income: number;
  expenses: number;
};

export type RecentTransaction = Transaction & { categoryName: string };

export type Dashboard = {
  month: string; // the current month, "YYYY-MM"
  balance: number; // all income minus all expenses, ever
  totalSaved: number; // what all savings goals hold
  income: number; // this month
  spending: number; // this month
  spendingByCategory: SpendingSlice[]; // this month, biggest first
  monthlyTotals: MonthlyTotals[]; // the last few months, oldest first
  recent: RecentTransaction[];
};
