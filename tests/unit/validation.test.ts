import { describe, expect, it } from "vitest";
import {
  categoryInputSchema,
  categoryUpdateSchema,
} from "@/lib/validation/category";
import { transactionInputSchema } from "@/lib/validation/transaction";

const validTransaction = {
  description: "Supermarket",
  amount: "123.45",
  type: "EXPENSE",
  categoryId: "cat-1",
  date: "2026-10-29",
};

const parseTransaction = (overrides: Record<string, unknown> = {}) =>
  transactionInputSchema.safeParse({ ...validTransaction, ...overrides });

const messageFor = (result: ReturnType<typeof parseTransaction>) =>
  result.success ? null : result.error.issues[0].message;

describe("transactionInputSchema", () => {
  it("accepts a valid transaction and fills in the defaults", () => {
    const result = parseTransaction();

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      description: "Supermarket",
      amount: 123.45,
      currency: "ILS",
      type: "EXPENSE",
      categoryId: "cat-1",
      date: "2026-10-29",
      note: null,
    });
  });

  describe("amount", () => {
    it.each([
      ["12", 12],
      ["12.5", 12.5],
      ["0.01", 0.01],
      [" 12.50 ", 12.5],
      ["9999999999.99", 9999999999.99],
      [12.5, 12.5],
    ])("accepts %j", (amount, expected) => {
      expect(parseTransaction({ amount }).data?.amount).toBe(expected);
    });

    it.each([
      ["empty", ""],
      ["zero", "0"],
      ["zero with decimals", "0.00"],
      ["negative", "-5"],
      ["text", "abc"],
      ["three decimals", "12.345"],
      ["exponent notation", "1e3"],
      ["too large for Decimal(12, 2)", "10000000000"],
      ["leading dot", ".5"],
      ["thousands separator", "1,000"],
      ["trailing dot", "12."],
      ["floating point noise", 0.1 + 0.2],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["negative number", -5],
      ["missing", undefined],
    ])("rejects %s", (_name, amount) => {
      expect(parseTransaction({ amount }).success).toBe(false);
    });

    it("explains what is wrong", () => {
      expect(messageFor(parseTransaction({ amount: "0" }))).toBe("Amount must be greater than zero");
      expect(messageFor(parseTransaction({ amount: "12.345" }))).toBe("Enter an amount like 12.50");
    });
  });

  describe("description", () => {
    it("is trimmed", () => {
      expect(parseTransaction({ description: "  Coffee  " }).data?.description).toBe("Coffee");
    });

    it.each(["", "   "])("rejects %j", (description) => {
      expect(messageFor(parseTransaction({ description }))).toBe("Enter a description");
    });

    it("allows 120 characters but not 121", () => {
      expect(parseTransaction({ description: "a".repeat(120) }).success).toBe(true);
      expect(parseTransaction({ description: "a".repeat(121) }).success).toBe(false);
    });
  });

  describe("date", () => {
    it.each(["2026-10-29", "2024-02-29", "1999-01-01"])("accepts %s", (date) => {
      expect(parseTransaction({ date }).success).toBe(true);
    });

    it.each(["", "2026-13-01", "2026-02-30", "2025-02-29", "29/10/2026", "2026-10-29T10:00:00Z", "yesterday"])(
      "rejects %j",
      (date) => {
        expect(parseTransaction({ date }).success).toBe(false);
      },
    );
  });

  describe("note", () => {
    it.each([undefined, "", "   "])("turns %j into null", (note) => {
      expect(parseTransaction({ note }).data?.note).toBeNull();
    });

    it("keeps and trims real text", () => {
      expect(parseTransaction({ note: "  for the party " }).data?.note).toBe("for the party");
    });

    it("allows 500 characters but not 501", () => {
      expect(parseTransaction({ note: "n".repeat(500) }).success).toBe(true);
      expect(parseTransaction({ note: "n".repeat(501) }).success).toBe(false);
    });
  });

  describe("currency", () => {
    it("accepts ILS", () => {
      expect(parseTransaction({ currency: "ILS" }).data?.currency).toBe("ILS");
    });

    it.each(["USD", "EUR", "ils", ""])("rejects %j until conversion exists", (currency) => {
      expect(parseTransaction({ currency }).success).toBe(false);
    });
  });

  describe("type and category", () => {
    it.each(["INCOME", "EXPENSE"])("accepts %s", (type) => {
      expect(parseTransaction({ type }).success).toBe(true);
    });

    it.each(["income", "TRANSFER", ""])("rejects type %j", (type) => {
      expect(parseTransaction({ type }).success).toBe(false);
    });

    it("requires a category", () => {
      expect(messageFor(parseTransaction({ categoryId: "" }))).toBe("Choose a category");
      expect(parseTransaction({ categoryId: undefined }).success).toBe(false);
    });
  });

  it("drops fields it doesn't know, so a client can't smuggle in a userId", () => {
    const result = parseTransaction({ userId: "someone-else", id: "chosen-id", createdAt: "2020-01-01" });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("userId");
    expect(result.data).not.toHaveProperty("id");
    expect(result.data).not.toHaveProperty("createdAt");
  });
});

describe("categoryInputSchema", () => {
  const valid = { name: "Groceries", type: "EXPENSE", color: "#F59E0B" };

  it("accepts a valid category and lowercases the color", () => {
    expect(categoryInputSchema.parse(valid)).toEqual({
      name: "Groceries",
      type: "EXPENSE",
      color: "#f59e0b",
    });
  });

  it("trims the name", () => {
    expect(categoryInputSchema.parse({ ...valid, name: "  Rent " }).name).toBe("Rent");
  });

  it.each(["", "   "])("rejects the name %j", (name) => {
    expect(categoryInputSchema.safeParse({ ...valid, name }).success).toBe(false);
  });

  it("allows 40 characters but not 41", () => {
    expect(categoryInputSchema.safeParse({ ...valid, name: "a".repeat(40) }).success).toBe(true);
    expect(categoryInputSchema.safeParse({ ...valid, name: "a".repeat(41) }).success).toBe(false);
  });

  it.each(["red", "#fff", "10b981", "#10b98", "#10b9811", "#gggggg", "url(javascript:1)", ""])(
    "rejects the color %j",
    (color) => {
      expect(categoryInputSchema.safeParse({ ...valid, color }).success).toBe(false);
    },
  );

  it.each(["income", "OTHER", undefined])("rejects the type %j", (type) => {
    expect(categoryInputSchema.safeParse({ ...valid, type }).success).toBe(false);
  });

  it("drops fields it doesn't know", () => {
    const result = categoryInputSchema.parse({ ...valid, userId: "someone-else" });
    expect(result).not.toHaveProperty("userId");
  });
});

describe("categoryUpdateSchema", () => {
  it("only allows changing the name and color, never the type", () => {
    const result = categoryUpdateSchema.parse({
      name: "Food",
      color: "#10b981",
      type: "INCOME",
    });

    expect(result).toEqual({ name: "Food", color: "#10b981" });
  });
});
