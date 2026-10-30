import type { Currency } from "@/types/finance";

export type BudgetRow = {
  categoryId: string;
  name: string;
  color: string;
  // null when the category has no budget for the month
  budgetId: string | null;
  limit: number | null;
  currency: Currency;
  spent: number;
};

export type BudgetOverview = {
  month: string; // the month shown, "YYYY-MM"
  thisMonth: string; // the real current month, "YYYY-MM"
  rows: BudgetRow[]; // every expense category: budgeted ones first
  totalBudget: number;
  budgetedSpent: number; // spent in categories that have a budget
  unbudgetedSpent: number; // spent in categories that don't
};
