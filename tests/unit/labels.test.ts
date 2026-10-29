import { describe, expect, it } from "vitest";
import { categoryUsageText } from "@/lib/labels";

describe("categoryUsageText", () => {
  it.each([
    [1, 0, "1 transaction"],
    [12, 0, "12 transactions"],
    [0, 1, "1 budget"],
    [0, 3, "3 budgets"],
    [12, 3, "12 transactions and 3 budgets"],
    [1, 1, "1 transaction and 1 budget"],
    [0, 0, ""],
  ])("%i transactions, %i budgets -> %j", (transactions, budgets, expected) => {
    expect(categoryUsageText(transactions, budgets)).toBe(expected);
  });
});
