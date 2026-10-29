import type { Budget } from "@/types/finance";

const monthlyLimits: Record<string, number> = {
  "cat-rent": 2400,
  "cat-groceries": 1200,
  "cat-transport": 300,
  "cat-utilities": 400,
  "cat-dining": 300,
  "cat-entertainment": 250,
  "cat-health": 300,
  "cat-shopping": 400,
};

// Budget.month is the first day of the month
export const budgets: Budget[] = ["2026-08-01", "2026-09-01", "2026-10-01"].flatMap(
  (month) =>
    Object.entries(monthlyLimits).map(([categoryId, limit]) => ({
      id: `b-${month}-${categoryId}`,
      categoryId,
      month,
      limit,
      currency: "ILS" as const,
    })),
);
