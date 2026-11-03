import { describe, expect, it } from "vitest";
import { summarizeImport } from "@/lib/import/summary";
import type { ImportChoice, ImportRow } from "@/lib/import/types";

const rows: ImportRow[] = [
  { sourceRow: 2, date: "2026-10-30", description: "Supermarket", amount: 245.3 },
  { sourceRow: 3, date: "2026-10-31", description: "Cafe", amount: 18 },
  { sourceRow: 4, date: "2026-11-01", description: "Pharmacy", amount: 45.1 },
  { sourceRow: 5, date: "2026-11-02", description: "Bakery", amount: 12.2 },
];

const names = new Map([
  ["food", "Groceries"],
  ["eating", "Eating out"],
  ["health", "Health"],
]);

const choose = (categoryId: string | null, skipped = false): ImportChoice => ({ categoryId, skipped });

describe("summarizeImport", () => {
  it("adds the rows that were given a category, with that category", () => {
    const { entries, leftOut } = summarizeImport(
      rows,
      { 2: choose("food"), 3: choose("eating"), 4: choose("health"), 5: choose("food") },
      names,
    );

    expect(entries.map((e) => [e.sourceRow, e.categoryId])).toEqual([
      [2, "food"],
      [3, "eating"],
      [4, "health"],
      [5, "food"],
    ]);
    expect(leftOut).toBe(0);
  });

  it("keeps everything else about the row", () => {
    const [entry] = summarizeImport(rows, { 2: choose("food") }, names).entries;

    expect(entry).toEqual({
      sourceRow: 2,
      date: "2026-10-30",
      description: "Supermarket",
      amount: 245.3,
      categoryId: "food",
    });
  });

  it("leaves out skipped rows, even one that still has a category from before", () => {
    const { entries, leftOut } = summarizeImport(
      rows,
      { 2: choose("food"), 3: choose("eating", true), 4: choose(null, true), 5: choose("food") },
      names,
    );

    expect(entries.map((e) => e.sourceRow)).toEqual([2, 5]);
    expect(leftOut).toBe(2);
  });

  it("leaves out rows that were never decided", () => {
    const { entries, leftOut } = summarizeImport(rows, { 2: choose("food") }, names);

    expect(entries).toHaveLength(1);
    expect(leftOut).toBe(3);
  });

  it("leaves out a row whose category no longer exists", () => {
    const { entries, leftOut } = summarizeImport(rows, { 2: choose("deleted"), 3: choose("eating") }, names);

    expect(entries.map((e) => e.sourceRow)).toEqual([3]);
    expect(leftOut).toBe(3);
  });

  it("totals each category, biggest first", () => {
    const { byCategory, total } = summarizeImport(
      rows,
      { 2: choose("food"), 3: choose("eating"), 4: choose("health"), 5: choose("food") },
      names,
    );

    expect(byCategory).toEqual([
      { categoryId: "food", name: "Groceries", count: 2, total: 257.5 },
      { categoryId: "health", name: "Health", count: 1, total: 45.1 },
      { categoryId: "eating", name: "Eating out", count: 1, total: 18 },
    ]);
    expect(total).toBe(320.6);
  });

  it("orders categories with the same total by name", () => {
    const { byCategory } = summarizeImport(
      [
        { sourceRow: 2, date: "2026-10-30", description: "A", amount: 10 },
        { sourceRow: 3, date: "2026-10-30", description: "B", amount: 10 },
      ],
      { 2: choose("health"), 3: choose("eating") },
      names,
    );

    expect(byCategory.map((c) => c.name)).toEqual(["Eating out", "Health"]);
  });

  it("adds cents exactly", () => {
    const { total, byCategory } = summarizeImport(
      [
        { sourceRow: 2, date: "2026-10-30", description: "A", amount: 0.1 },
        { sourceRow: 3, date: "2026-10-30", description: "B", amount: 0.2 },
      ],
      { 2: choose("food"), 3: choose("food") },
      names,
    );

    expect(total).toBe(0.3);
    expect(byCategory[0].total).toBe(0.3);
  });

  it("is empty when there is nothing to import", () => {
    expect(summarizeImport([], {}, names)).toEqual({ entries: [], leftOut: 0, byCategory: [], total: 0 });
    expect(summarizeImport(rows, {}, names)).toMatchObject({ entries: [], leftOut: 4, byCategory: [], total: 0 });
  });
});
