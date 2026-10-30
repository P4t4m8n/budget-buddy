import { describe, expect, it } from "vitest";
import { budgetInputSchema } from "@/lib/validation/budget";

const valid = { categoryId: "cat-1", month: "2026-10", limit: "2400" };

const parse = (overrides: Record<string, unknown> = {}) =>
  budgetInputSchema.safeParse({ ...valid, ...overrides });

const messageFor = (result: ReturnType<typeof parse>) =>
  result.success ? null : result.error.issues[0].message;

describe("budgetInputSchema", () => {
  it("accepts a valid budget and fills in the currency", () => {
    expect(parse().data).toEqual({
      categoryId: "cat-1",
      month: "2026-10",
      limit: 2400,
      currency: "ILS",
    });
  });

  describe("limit", () => {
    it.each([
      ["2400", 2400],
      ["0.01", 0.01],
      ["99.5", 99.5],
      [" 12.50 ", 12.5],
      ["9999999999.99", 9999999999.99],
      [500, 500],
    ])("accepts %j", (limit, expected) => {
      expect(parse({ limit }).data?.limit).toBe(expected);
    });

    it.each([
      ["empty", ""],
      ["zero", "0"],
      ["negative", "-5"],
      ["text", "abc"],
      ["three decimals", "1.234"],
      ["exponent notation", "1e3"],
      ["too large for Decimal(12, 2)", "10000000000"],
      ["thousands separator", "1,000"],
      ["floating point noise", 0.1 + 0.2],
      ["missing", undefined],
    ])("rejects %s", (_name, limit) => {
      expect(parse({ limit }).success).toBe(false);
    });

    it("explains what is wrong", () => {
      expect(messageFor(parse({ limit: "0" }))).toBe("Amount must be greater than zero");
      expect(messageFor(parse({ limit: "1.234" }))).toBe("Enter an amount like 12.50");
    });
  });

  describe("month", () => {
    it.each(["2026-01", "2026-12", "2027-03"])("accepts %s", (month) => {
      expect(parse({ month }).success).toBe(true);
    });

    it.each(["", "2026-13", "2026-1", "2026-10-01", "October", "1999-01"])("rejects %j", (month) => {
      expect(messageFor(parse({ month }))).toBe("Choose a valid month");
    });

    it("is required", () => {
      expect(parse({ month: undefined }).success).toBe(false);
    });
  });

  describe("category", () => {
    it("is required", () => {
      expect(messageFor(parse({ categoryId: "" }))).toBe("Choose a category");
      expect(parse({ categoryId: undefined }).success).toBe(false);
    });
  });

  describe("currency", () => {
    it("accepts ILS", () => {
      expect(parse({ currency: "ILS" }).data?.currency).toBe("ILS");
    });

    it.each(["USD", "EUR", "ils", ""])("rejects %j until conversion exists", (currency) => {
      expect(parse({ currency }).success).toBe(false);
    });
  });

  it("drops fields it doesn't know, so a client can't smuggle in a userId or id", () => {
    const result = parse({ userId: "someone-else", id: "chosen-id" });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("userId");
    expect(result.data).not.toHaveProperty("id");
  });
});
