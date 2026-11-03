import type { GeneralBudget, BudgetRow } from "@/types/budget";
import type { Transaction } from "@/types/finance";

// A category that has a budget this month, with what has been spent of it
export type BudgetedRow = BudgetRow & { budgetId: string; limit: number };

// This month's budgets, for the dashboard
export type DashboardBudget = {
  general: GeneralBudget | null;
  totalSpent: number; // everything spent this month, in any category
  categories: BudgetedRow[]; // only categories with a budget, the most used first
};

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
  budget: DashboardBudget; // this month's budgets
  income: number; // this month
  spending: number; // this month
  spendingByCategory: SpendingSlice[]; // this month, biggest first
  monthlyTotals: MonthlyTotals[]; // the last few months, oldest first
  recent: RecentTransaction[];
};
