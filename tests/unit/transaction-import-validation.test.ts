import { describe, expect, it } from "vitest";
import { importInputSchema } from "@/lib/validation/transaction-import";

const row = (overrides: Record<string, unknown> = {}) => ({
  description: "Shop",
  amount: 12.5,
  date: "2026-10-31",
  categoryId: "cat-1",
  ...overrides,
});

const parse = (rows: unknown) => importInputSchema.safeParse(rows);
const message = (rows: unknown) => {
  const result = parse(rows);
  return result.success ? null : result.error.issues[0];
};

describe("importInputSchema", () => {
  it("accepts rows with a description, amount, date and category", () => {
    expect(parse([row(), row({ description: "Cafe", amount: "3.20", date: "2026-11-01", categoryId: "cat-2" })]).data).toEqual([
      { description: "Shop", amount: 12.5, date: "2026-10-31", categoryId: "cat-1" },
      { description: "Cafe", amount: 3.2, date: "2026-11-01", categoryId: "cat-2" },
    ]);
  });

  it("only passes on those four things: the owner, type, currency and note can't be chosen", () => {
    const [parsed] = parse([row({ userId: "someone-else", type: "INCOME", currency: "USD", note: "x", id: "chosen" })]).data!;

    expect(parsed).toEqual({ description: "Shop", amount: 12.5, date: "2026-10-31", categoryId: "cat-1" });
  });

  it("trims the description", () => {
    expect(parse([row({ description: "  Shop  " })]).data?.[0].description).toBe("Shop");
  });

  describe("how many rows", () => {
    it("needs at least one", () => {
      expect(message([])?.message).toBe("There is nothing to import");
    });

    it("accepts 500 and rejects 501", () => {
      expect(parse(Array.from({ length: 500 }, () => row())).success).toBe(true);
      expect(message(Array.from({ length: 501 }, () => row()))?.message).toBe("Import up to 500 transactions at a time");
    });
  });

  describe("not rows at all", () => {
    it.each([undefined, null, "rows", 42, {}, { 0: row() }, [null], ["x"], [42], [[]]])("rejects %j", (value) => {
      expect(parse(value).success).toBe(false);
    });
  });

  describe("each row is checked like a transaction, and says which row is wrong", () => {
    it.each([
      ["no description", { description: "" }, "description", "Enter a description"],
      ["a blank description", { description: "   " }, "description", "Enter a description"],
      ["a description over 120 characters", { description: "a".repeat(121) }, "description", "Keep the description under 120 characters"],
      ["a zero amount", { amount: 0 }, "amount", "Amount must be greater than zero"],
      ["a negative amount", { amount: -5 }, "amount", "Enter an amount like 12.50"],
      ["an amount with too many decimals", { amount: "1.234" }, "amount", "Enter an amount like 12.50"],
      ["an amount that is too large", { amount: "12345678901" }, "amount", "Enter an amount like 12.50"],
      ["no amount", { amount: undefined }, "amount", "Enter an amount like 12.50"],
      ["a bad date", { date: "2026-02-30" }, "date", "Enter a valid date"],
      ["a date in the wrong format", { date: "31/10/2026" }, "date", "Enter a valid date"],
      ["no category", { categoryId: "" }, "categoryId", "Choose a category"],
    ])("rejects %s", (_name, override, field, expected) => {
      const issue = message([row(), row(override)]);

      expect(issue).toMatchObject({ message: expected, path: [1, field] });
    });
  });

  it("accepts the largest amount a transaction can hold", () => {
    expect(parse([row({ amount: 9999999999.99 })]).data?.[0].amount).toBe(9999999999.99);
  });
});
