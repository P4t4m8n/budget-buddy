import type { ImportChoice, ImportRow, SuggestionSource } from "./types";

export type Suggestion = {
  categoryId: string;
  source: SuggestionSource;
};

// "Supersal", "SUPERSAL" and " Supersal  " are the same description; "Supersal 1234" is not
export const descriptionKey = (description: string) =>
  description.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase();

type PastTransaction = {
  description: string;
  categoryId: string;
  type: "INCOME" | "EXPENSE";
};

// For each description, the category the user has filed it under most often. Only expenses
// count (an import adds expenses), and only categories that can still be chosen. When two
// categories are equally common the one met first wins, so pass the newest transactions first.
export const buildCategoryHistory = (
  transactions: readonly PastTransaction[],
  validCategoryIds: ReadonlySet<string>,
): Map<string, string> => {
  const counts = new Map<string, Map<string, number>>();

  for (const transaction of transactions) {
    if (transaction.type !== "EXPENSE" || !validCategoryIds.has(transaction.categoryId)) continue;

    const key = descriptionKey(transaction.description);
    if (key === "") continue;

    const byCategory = counts.get(key) ?? new Map<string, number>();
    byCategory.set(transaction.categoryId, (byCategory.get(transaction.categoryId) ?? 0) + 1);
    counts.set(key, byCategory);
  }

  const history = new Map<string, string>();
  for (const [key, byCategory] of counts) {
    let best: string | null = null;
    let bestCount = 0;
    // A Map keeps the order things were first added, which is the order they were met
    for (const [categoryId, count] of byCategory) {
      if (count > bestCount) {
        best = categoryId;
        bestCount = count;
      }
    }
    if (best !== null) history.set(key, best);
  }
  return history;
};

// The category to suggest for the row at `position`. What the user chose earlier in this
// import comes first, the nearest earlier row with the same description winning, because it
// is the freshest decision; then the user's existing transactions. Skipped rows teach
// nothing, and neither does a category that can no longer be chosen.
export const suggestCategory = (
  rows: readonly ImportRow[],
  position: number,
  choices: Record<number, ImportChoice | undefined>,
  history: ReadonlyMap<string, string>,
  validCategoryIds: ReadonlySet<string>,
): Suggestion | null => {
  const row = rows[position];
  if (!row) return null;

  const key = descriptionKey(row.description);
  if (key === "") return null;

  for (let index = position - 1; index >= 0; index--) {
    const choice = choices[rows[index].sourceRow];
    if (
      choice &&
      !choice.skipped &&
      choice.categoryId &&
      validCategoryIds.has(choice.categoryId) &&
      descriptionKey(rows[index].description) === key
    ) {
      return { categoryId: choice.categoryId, source: "import" };
    }
  }

  const past = history.get(key);
  return past !== undefined && validCategoryIds.has(past)
    ? { categoryId: past, source: "history" }
    : null;
};
