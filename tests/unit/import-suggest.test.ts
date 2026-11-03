import { describe, expect, it } from "vitest";
import { buildCategoryHistory, descriptionKey, suggestCategory } from "@/lib/import/suggest";
import type { ImportChoice, ImportRow } from "@/lib/import/types";

describe("descriptionKey", () => {
  it.each([
    ["Supersal", "supersal"],
    ["SUPERSAL", "supersal"],
    ["  Supersal  ", "supersal"],
    ["Super   sal\tdeal", "super sal deal"],
    ["Super\nsal", "super sal"],
    ["שופרסל דיל", "שופרסל דיל"],
    ["", ""],
    ["   ", ""],
  ])("turns %j into %j", (description, expected) => {
    expect(descriptionKey(description)).toBe(expected);
  });

  it("treats the same text written two ways as the same", () => {
    // "é" as one character, and as "e" plus a combining accent
    expect(descriptionKey("Caf\u00e9")).toBe(descriptionKey("Cafe\u0301"));
  });

  it("keeps descriptions that differ by a number apart", () => {
    expect(descriptionKey("Supersal 1234")).not.toBe(descriptionKey("Supersal 5678"));
  });
});

const valid = new Set(["food", "eating", "health"]);
const expense = (description: string, categoryId: string) => ({ description, categoryId, type: "EXPENSE" as const });

describe("buildCategoryHistory", () => {
  it("maps a description to the category it was filed under", () => {
    const history = buildCategoryHistory([expense("Supersal", "food"), expense("Cafe", "eating")], valid);

    expect(history.get("supersal")).toBe("food");
    expect(history.get("cafe")).toBe("eating");
    expect(history.size).toBe(2);
  });

  it("takes the category used most often", () => {
    const history = buildCategoryHistory(
      [expense("Supersal", "health"), expense("Supersal", "food"), expense("Supersal", "food")],
      valid,
    );

    expect(history.get("supersal")).toBe("food");
  });

  it("breaks a tie in favour of the first one met, which is the newest", () => {
    const history = buildCategoryHistory([expense("Supersal", "health"), expense("Supersal", "food")], valid);

    expect(history.get("supersal")).toBe("health");
  });

  it("adds up descriptions that only differ by capitals or spacing", () => {
    const history = buildCategoryHistory(
      [expense("Supersal", "health"), expense("SUPERSAL ", "food"), expense("  supersal", "food")],
      valid,
    );

    expect(history.get("supersal")).toBe("food");
  });

  it("ignores income", () => {
    const history = buildCategoryHistory(
      [{ description: "Supersal", categoryId: "food", type: "INCOME" }],
      valid,
    );

    expect(history.size).toBe(0);
  });

  it("ignores categories that can't be chosen", () => {
    const history = buildCategoryHistory(
      [expense("Supersal", "deleted"), expense("Supersal", "salary")],
      valid,
    );

    expect(history.size).toBe(0);
  });

  it("doesn't let an unusable category win a description over a usable one", () => {
    const history = buildCategoryHistory(
      [expense("Supersal", "gone"), expense("Supersal", "gone"), expense("Supersal", "food")],
      valid,
    );

    expect(history.get("supersal")).toBe("food");
  });

  it("ignores blank descriptions", () => {
    expect(buildCategoryHistory([expense("", "food"), expense("   ", "food")], valid).size).toBe(0);
  });

  it("is empty for no transactions", () => {
    expect(buildCategoryHistory([], valid).size).toBe(0);
  });
});

const rows: ImportRow[] = [
  { sourceRow: 2, date: "2026-10-30", description: "Supersal", amount: 245.3 },
  { sourceRow: 3, date: "2026-10-31", description: "Cafe", amount: 18 },
  { sourceRow: 4, date: "2026-11-01", description: "SUPERSAL ", amount: 45.1 },
  { sourceRow: 5, date: "2026-11-02", description: "Supersal", amount: 12 },
];

const choose = (categoryId: string | null, skipped = false): ImportChoice => ({ categoryId, skipped });
const noHistory = new Map<string, string>();

describe("suggestCategory", () => {
  it("suggests what was chosen earlier in this import for the same description", () => {
    expect(suggestCategory(rows, 2, { 2: choose("food"), 3: choose("eating") }, noHistory, valid)).toEqual({
      categoryId: "food",
      source: "import",
    });
  });

  it("suggests nothing for a description that hasn't come up", () => {
    expect(suggestCategory(rows, 1, { 2: choose("food") }, noHistory, valid)).toBeNull();
  });

  it("uses the nearest earlier choice when the same description was filed differently before", () => {
    const choices = { 2: choose("food"), 4: choose("health") };

    expect(suggestCategory(rows, 3, choices, noHistory, valid)).toEqual({ categoryId: "health", source: "import" });
  });

  it("only looks at rows before this one", () => {
    expect(suggestCategory(rows, 0, { 4: choose("food"), 5: choose("food") }, noHistory, valid)).toBeNull();
  });

  it("learns nothing from a skipped row, even one that still has a category", () => {
    const choices = { 2: choose("food", true), 4: choose(null, true) };

    expect(suggestCategory(rows, 3, choices, noHistory, valid)).toBeNull();
  });

  it("learns nothing from a row that was never decided", () => {
    expect(suggestCategory(rows, 2, {}, noHistory, valid)).toBeNull();
  });

  it("doesn't suggest a category that can no longer be chosen", () => {
    expect(suggestCategory(rows, 2, { 2: choose("deleted") }, noHistory, valid)).toBeNull();
  });

  it("falls back to the user's existing transactions", () => {
    const history = new Map([["supersal", "health"]]);

    expect(suggestCategory(rows, 0, {}, history, valid)).toEqual({ categoryId: "health", source: "history" });
  });

  it("prefers this import's choices to the existing transactions", () => {
    const history = new Map([["supersal", "health"]]);

    expect(suggestCategory(rows, 2, { 2: choose("food") }, history, valid)).toEqual({
      categoryId: "food",
      source: "import",
    });
  });

  it("uses the existing transactions when the earlier choices were all skipped", () => {
    const history = new Map([["supersal", "health"]]);

    expect(suggestCategory(rows, 2, { 2: choose("food", true) }, history, valid)).toEqual({
      categoryId: "health",
      source: "history",
    });
  });

  it("doesn't suggest an existing category that can no longer be chosen", () => {
    expect(suggestCategory(rows, 0, {}, new Map([["supersal", "deleted"]]), valid)).toBeNull();
  });

  it("matches a description whatever the capitals and spacing", () => {
    expect(suggestCategory(rows, 2, { 2: choose("food") }, noHistory, valid)?.categoryId).toBe("food");
  });

  it("suggests nothing for a blank description", () => {
    const blank: ImportRow[] = [
      { sourceRow: 2, date: "2026-10-30", description: " ", amount: 1 },
      { sourceRow: 3, date: "2026-10-30", description: " ", amount: 1 },
    ];

    expect(suggestCategory(blank, 1, { 2: choose("food") }, new Map([["", "food"]]), valid)).toBeNull();
  });

  it("suggests nothing for a position that doesn't exist", () => {
    expect(suggestCategory(rows, 99, {}, noHistory, valid)).toBeNull();
    expect(suggestCategory([], 0, {}, noHistory, valid)).toBeNull();
  });
});
