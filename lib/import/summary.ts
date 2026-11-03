import type { ImportChoice, ImportRow } from "./types";

export type ImportEntry = ImportRow & { categoryId: string };

export type CategoryTotal = {
  categoryId: string;
  name: string;
  count: number;
  total: number;
};

export type ImportSummary = {
  // The rows that will be added: a category was chosen and they weren't skipped
  entries: ImportEntry[];
  // Rows the user skipped, or never chose a category for
  leftOut: number;
  byCategory: CategoryTotal[];
  total: number;
};

// Amounts are added as whole cents, so 0.1 + 0.2 is 0.3 and not 0.30000000000000004
const toCents = (amount: number) => Math.round(amount * 100);

// What an import would add, from the user's decisions: grouped by category (biggest first)
export const summarizeImport = (
  rows: ImportRow[],
  choices: Record<number, ImportChoice | undefined>,
  categoryNames: ReadonlyMap<string, string>,
): ImportSummary => {
  const entries: ImportEntry[] = [];

  for (const row of rows) {
    const choice = choices[row.sourceRow];
    if (choice && !choice.skipped && choice.categoryId && categoryNames.has(choice.categoryId)) {
      entries.push({ ...row, categoryId: choice.categoryId });
    }
  }

  const cents = new Map<string, { count: number; cents: number }>();
  for (const entry of entries) {
    const current = cents.get(entry.categoryId) ?? { count: 0, cents: 0 };
    cents.set(entry.categoryId, {
      count: current.count + 1,
      cents: current.cents + toCents(entry.amount),
    });
  }

  const byCategory = [...cents.entries()]
    .map(([categoryId, { count, cents: total }]) => ({
      categoryId,
      name: categoryNames.get(categoryId) ?? "",
      count,
      total: total / 100,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return {
    entries,
    leftOut: rows.length - entries.length,
    byCategory,
    total: entries.reduce((sum, entry) => sum + toCents(entry.amount), 0) / 100,
  };
};
