import { describe, expect, it } from "vitest";
import { depositInputSchema, goalInputSchema } from "@/lib/validation/savings";

const validGoal = { name: "Emergency fund", targetAmount: "20000", targetDate: "2027-06-30" };

const parseGoal = (overrides: Record<string, unknown> = {}) =>
  goalInputSchema.safeParse({ ...validGoal, ...overrides });

const goalMessage = (result: ReturnType<typeof parseGoal>) =>
  result.success ? null : result.error.issues[0].message;

describe("goalInputSchema", () => {
  it("accepts a valid goal and fills in the currency", () => {
    expect(parseGoal().data).toEqual({
      name: "Emergency fund",
      targetAmount: 20000,
      currency: "ILS",
      targetDate: "2027-06-30",
    });
  });

  describe("name", () => {
    it("is trimmed", () => {
      expect(parseGoal({ name: "  Trip " }).data?.name).toBe("Trip");
    });

    it.each(["", "   "])("rejects %j", (name) => {
      expect(goalMessage(parseGoal({ name }))).toBe("Enter a name");
    });

    it("accepts 80 characters and rejects 81", () => {
      expect(parseGoal({ name: "a".repeat(80) }).success).toBe(true);
      expect(goalMessage(parseGoal({ name: "a".repeat(81) }))).toBe("Keep the name under 80 characters");
    });
  });

  describe("targetAmount", () => {
    it.each([
      ["20000", 20000],
      ["0.01", 0.01],
      [" 150.50 ", 150.5],
      ["9999999999.99", 9999999999.99],
      [500, 500],
    ])("accepts %j", (targetAmount, expected) => {
      expect(parseGoal({ targetAmount }).data?.targetAmount).toBe(expected);
    });

    it.each(["", "0", "-5", "abc", "1.234", "1e3", "12345678901"])("rejects %j", (targetAmount) => {
      expect(parseGoal({ targetAmount }).success).toBe(false);
    });
  });

  describe("targetDate", () => {
    it.each([undefined, ""])("is optional: %j becomes null", (targetDate) => {
      expect(parseGoal({ targetDate }).data?.targetDate).toBeNull();
    });

    it.each(["13/01/2027", "2027-13-01", "2027-02-30", "soon"])("rejects %j", (targetDate) => {
      expect(goalMessage(parseGoal({ targetDate }))).toBe("Enter a valid date");
    });
  });

  it("only allows ILS for now", () => {
    expect(parseGoal({ currency: "USD" }).success).toBe(false);
  });
});

const validDeposit = { kind: "DEPOSIT", amount: "500", date: "2026-10-29", note: "Salary" };

const parseDeposit = (overrides: Record<string, unknown> = {}) =>
  depositInputSchema.safeParse({ ...validDeposit, ...overrides });

const depositMessage = (result: ReturnType<typeof parseDeposit>) =>
  result.success ? null : result.error.issues[0].message;

describe("depositInputSchema", () => {
  it("keeps a deposit positive", () => {
    expect(parseDeposit().data).toEqual({ amount: 500, date: "2026-10-29", note: "Salary" });
  });

  it("stores a withdrawal as a negative amount", () => {
    expect(parseDeposit({ kind: "WITHDRAWAL", amount: "120.50" }).data?.amount).toBe(-120.5);
  });

  it("doesn't pass the kind on: the sign carries it", () => {
    expect(parseDeposit().data).not.toHaveProperty("kind");
  });

  it.each(["", "TRANSFER", "deposit"])("rejects the kind %j", (kind) => {
    expect(parseDeposit({ kind }).success).toBe(false);
  });

  describe("amount", () => {
    it.each(["", "0", "-5", "abc", "1.234", "1e3"])(
      "rejects %j: the form asks for a plain amount, the kind decides the sign",
      (amount) => {
        expect(parseDeposit({ amount }).success).toBe(false);
      },
    );

    it("rejects a withdrawal of zero", () => {
      expect(depositMessage(parseDeposit({ kind: "WITHDRAWAL", amount: "0" }))).toBe(
        "Amount must be greater than zero",
      );
    });
  });

  describe("date", () => {
    it.each(["", "2026-13-01", "2026-02-30", "29/10/2026"])("rejects %j", (date) => {
      expect(depositMessage(parseDeposit({ date }))).toBe("Enter a valid date");
    });
  });

  describe("note", () => {
    it("is optional and trimmed, and blank becomes null", () => {
      expect(parseDeposit({ note: undefined }).data?.note).toBeNull();
      expect(parseDeposit({ note: "   " }).data?.note).toBeNull();
      expect(parseDeposit({ note: "  Bonus " }).data?.note).toBe("Bonus");
    });

    it("accepts 200 characters and rejects 201", () => {
      expect(parseDeposit({ note: "a".repeat(200) }).success).toBe(true);
      expect(depositMessage(parseDeposit({ note: "a".repeat(201) }))).toBe("Keep the note under 200 characters");
    });
  });
});
