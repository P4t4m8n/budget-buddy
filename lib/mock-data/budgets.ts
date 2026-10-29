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

export const budgets: Budget[] = ["2026-08", "2026-09", "2026-10"].flatMap(
  (month) =>
    Object.entries(monthlyLimits).map(([categoryId, limit]) => ({
      id: `b-${month}-${categoryId}`,
      categoryId,
      month,
      limit,
      currency: "ILS" as const,
    })),
);
