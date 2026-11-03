import { describe, expect, it } from "vitest";
import { valueSchema } from "@/lib/validation/amount";
import {
  investmentInputSchema,
  investmentUpdateSchema,
  valueUpdateSchema,
} from "@/lib/validation/investment";

const valid = {
  name: "S&P 500 ETF",
  type: "ETF",
  ticker: "voo",
  amountInvested: "8000",
  currentValue: "9150.50",
  purchaseDate: "2025-03-10",
};

const parse = (overrides: Record<string, unknown> = {}) =>
  investmentInputSchema.safeParse({ ...valid, ...overrides });

const messageFor = (result: ReturnType<typeof parse>) =>
  result.success ? null : result.error.issues[0].message;

describe("investmentInputSchema", () => {
  it("accepts a valid investment, fills in the currency and upper-cases the ticker", () => {
    expect(parse().data).toEqual({
      name: "S&P 500 ETF",
      type: "ETF",
      ticker: "VOO",
      amountInvested: 8000,
      currentValue: 9150.5,
      currency: "ILS",
      purchaseDate: "2025-03-10",
    });
  });

  describe("name", () => {
    it("is trimmed", () => {
      expect(parse({ name: "  Apple " }).data?.name).toBe("Apple");
    });

    it.each(["", "   "])("rejects %j", (name) => {
      expect(messageFor(parse({ name }))).toBe("Enter a name");
    });

    it("accepts 80 characters and rejects 81", () => {
      expect(parse({ name: "a".repeat(80) }).success).toBe(true);
      expect(messageFor(parse({ name: "a".repeat(81) }))).toBe("Keep the name under 80 characters");
    });
  });

  describe("type", () => {
    it.each(["STOCK", "ETF", "CRYPTO", "BOND", "OTHER"])("accepts %s", (type) => {
      expect(parse({ type }).data?.type).toBe(type);
    });

    it.each(["", "etf", "FUND", "stock "])("rejects %j", (type) => {
      expect(parse({ type }).success).toBe(false);
    });
  });

  describe("ticker", () => {
    it("is optional: nothing, blank and spaces become null", () => {
      for (const ticker of [undefined, "", "   "]) {
        expect(parse({ ticker }).data?.ticker).toBeNull();
      }
    });

    it("is trimmed and upper-cased", () => {
      expect(parse({ ticker: "  btc-usd " }).data?.ticker).toBe("BTC-USD");
    });

    it("accepts 15 characters and rejects 16", () => {
      expect(parse({ ticker: "A".repeat(15) }).success).toBe(true);
      expect(messageFor(parse({ ticker: "A".repeat(16) }))).toBe("Keep the ticker under 15 characters");
    });
  });

  describe("amountInvested", () => {
    it.each([
      ["8000", 8000],
      ["0.01", 0.01],
      [" 150.50 ", 150.5],
      ["9999999999.99", 9999999999.99],
      [500, 500],
    ])("accepts %j", (amountInvested, expected) => {
      expect(parse({ amountInvested }).data?.amountInvested).toBe(expected);
    });

    it.each(["", "0", "-5", "abc", "1.234", "1e3", "12345678901"])("rejects %j", (amountInvested) => {
      expect(parse({ amountInvested }).success).toBe(false);
    });

    it("must be above zero", () => {
      expect(messageFor(parse({ amountInvested: "0" }))).toBe("Amount must be greater than zero");
    });
  });

  describe("currentValue", () => {
    it.each([
      ["9150.50", 9150.5],
      ["0.01", 0.01],
      ["0", 0],
      ["0.00", 0],
      [" 12 ", 12],
      [0, 0],
    ])("accepts %j: an investment can be worth nothing", (currentValue, expected) => {
      expect(parse({ currentValue }).data?.currentValue).toBe(expected);
    });

    it.each(["", "-1", "-0.01", "abc", "1.234", "1e3", "12345678901"])("rejects %j", (currentValue) => {
      expect(messageFor(parse({ currentValue }))).toBe("Enter an amount like 12.50");
    });
  });

  describe("purchaseDate", () => {
    it.each(["", "2025-13-01", "2025-02-30", "10/03/2025", "yesterday"])("rejects %j", (purchaseDate) => {
      expect(messageFor(parse({ purchaseDate }))).toBe("Enter a valid date");
    });
  });

  it("only allows ILS for now", () => {
    expect(parse({ currency: "USD" }).success).toBe(false);
  });
});

describe("investmentUpdateSchema", () => {
  const parseUpdate = (overrides: Record<string, unknown> = {}) =>
    investmentUpdateSchema.safeParse({ ...valid, ...overrides });

  it("accepts the same fields without the current value, and doesn't pass one on", () => {
    const result = parseUpdate({ currentValue: "999999" });

    expect(result.data).toEqual({
      name: "S&P 500 ETF",
      type: "ETF",
      ticker: "VOO",
      amountInvested: 8000,
      currency: "ILS",
      purchaseDate: "2025-03-10",
    });
    expect(result.data).not.toHaveProperty("currentValue");
  });

  it("doesn't mind the current value being missing or invalid: the edit form doesn't have one", () => {
    expect(parseUpdate({ currentValue: "" }).success).toBe(true);
    expect(parseUpdate({ currentValue: undefined }).success).toBe(true);
  });

  it("still checks everything it does take", () => {
    expect(parseUpdate({ name: "" }).success).toBe(false);
    expect(parseUpdate({ amountInvested: "0" }).success).toBe(false);
  });
});

describe("valueUpdateSchema", () => {
  it.each([
    ["9150.50", 9150.5],
    ["0", 0],
    [" 12 ", 12],
    [12.5, 12.5],
  ])("accepts %j", (value, expected) => {
    expect(valueUpdateSchema.safeParse({ value }).data).toEqual({ value: expected });
  });

  it.each(["", "-1", "abc", "1.234", "1e3", undefined])("rejects %j", (value) => {
    expect(valueUpdateSchema.safeParse({ value }).success).toBe(false);
  });
});

describe("valueSchema", () => {
  it("is the amount check with zero allowed", () => {
    expect(valueSchema.safeParse("0").data).toBe(0);
    expect(valueSchema.safeParse("9999999999.99").data).toBe(9999999999.99);
    expect(valueSchema.safeParse("10000000000").success).toBe(false);
  });
});
