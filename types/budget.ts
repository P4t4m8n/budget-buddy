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

// The general budget for a month: every expense counts against it, whatever its category
export type GeneralBudget = {
  budgetId: string;
  limit: number;
  currency: Currency;
  // limit - everything spent; negative when over budget
  remaining: number;
};

export type BudgetOverview = {
  month: string; // the month shown, "YYYY-MM"
  thisMonth: string; // the real current month, "YYYY-MM"
  rows: BudgetRow[]; // every expense category: budgeted ones first
  totalBudget: number; // the category budgets added up
  budgetedSpent: number; // spent in categories that have a budget
  unbudgetedSpent: number; // spent in categories that don't
  totalSpent: number; // everything spent in the month, budgeted or not
  general: GeneralBudget | null; // null when the month has no general budget
};
