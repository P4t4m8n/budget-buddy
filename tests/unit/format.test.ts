import { describe, expect, it } from "vitest";
import { formatCurrency } from "@/lib/format";

// Intl puts a no-break space before the symbol and wraps it in invisible direction marks
const plain = (text: string) =>
  text.replace(/[\u200e\u200f]/g, "").replace(/\u00a0/g, " ").trim();

describe("formatCurrency", () => {
  it.each([
    [7200, "7,200 ₪"],
    [0, "0 ₪"],
    [1234567, "1,234,567 ₪"],
    [123.45, "123.45 ₪"],
    [12.5, "12.50 ₪"],
    [0.05, "0.05 ₪"],
    [-45.5, "-45.50 ₪"],
  ])("formats %d as %s", (amount, expected) => {
    expect(plain(formatCurrency(amount))).toBe(expected);
  });

  it("rounds to cents rather than showing floating point noise", () => {
    expect(plain(formatCurrency(0.1 + 0.2))).toBe("0.30 ₪");
  });

  it("uses ILS unless told otherwise", () => {
    expect(formatCurrency(10)).toBe(formatCurrency(10, "ILS"));
  });

  it("formats other currencies with their own symbol", () => {
    expect(plain(formatCurrency(10, "USD"))).toContain("$");
    expect(plain(formatCurrency(10, "EUR"))).toContain("€");
  });
});
