import { describe, expect, it } from "vitest";
import { parseAmountCell, parseDateCell } from "@/lib/import/values";

describe("parseDateCell", () => {
  describe("text dates are day/month/year", () => {
    it.each([
      ["31/10/2026", "2026-10-31"],
      ["01/11/2026", "2026-11-01"],
      ["1/2/2026", "2026-02-01"],
      ["31.10.2026", "2026-10-31"],
      ["31-10-2026", "2026-10-31"],
      ["31/10/26", "2026-10-31"],
      ["5.3.07", "2007-03-05"],
      ["  31/10/2026  ", "2026-10-31"],
      ["29/02/2028", "2028-02-29"],
      ["31/12/2099", "2099-12-31"],
    ])("reads %j as %s", (text, expected) => {
      expect(parseDateCell(text)).toBe(expected);
    });

    it("never reads them as month/day: 10/11/2026 is the 10th of November", () => {
      expect(parseDateCell("10/11/2026")).toBe("2026-11-10");
    });

    it.each(["10/31/2026", "12/13/2026"])("rejects %j: there is no month 31 or 13", (text) => {
      expect(parseDateCell(text)).toBeNull();
    });
  });

  describe("year-first dates", () => {
    it.each([
      ["2026-10-31", "2026-10-31"],
      ["2026/10/31", "2026-10-31"],
      ["2026.10.31", "2026-10-31"],
      ["2026-1-5", "2026-01-05"],
    ])("reads %j as %s", (text, expected) => {
      expect(parseDateCell(text)).toBe(expected);
    });
  });

  describe("a time of day is ignored", () => {
    it.each([
      ["31/10/2026 14:30", "2026-10-31"],
      ["31/10/2026 14:30:59", "2026-10-31"],
      ["2026-10-31T14:30:00", "2026-10-31"],
      ["2026-10-31T14:30:00Z", "2026-10-31"],
      ["2026-10-31 14:30:00.123", "2026-10-31"],
      ["2026-10-31T14:30:00+02:00", "2026-10-31"],
    ])("reads %j as %s", (text, expected) => {
      expect(parseDateCell(text)).toBe(expected);
    });
  });

  describe("real calendar days only", () => {
    it.each([
      "31/02/2026",
      "30/02/2028",
      "29/02/2026",
      "00/10/2026",
      "31/04/2026",
      "31/00/2026",
      "2026-02-30",
      "2026-13-01",
    ])("rejects %j", (text) => {
      expect(parseDateCell(text)).toBeNull();
    });

    it.each(["31/10/1999", "01/01/2101", "01/01/1900"])("rejects %j: the year is out of range", (text) => {
      expect(parseDateCell(text)).toBeNull();
    });
  });

  describe("dates from a spreadsheet", () => {
    it("takes the day from a Date, at UTC midnight", () => {
      expect(parseDateCell(new Date("2026-10-31T00:00:00Z"))).toBe("2026-10-31");
    });

    it("takes the UTC day, whatever the time", () => {
      expect(parseDateCell(new Date("2026-10-31T23:59:59Z"))).toBe("2026-10-31");
      expect(parseDateCell(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11-01");
    });

    it("rejects an invalid Date", () => {
      expect(parseDateCell(new Date("nonsense"))).toBeNull();
    });

    it("reads a day number from a date cell that arrived as a plain number", () => {
      // 46326 is 2026-10-31 in a spreadsheet; 36526 is 2000-01-01
      expect(parseDateCell(46326)).toBe("2026-10-31");
      expect(parseDateCell(36526)).toBe("2000-01-01");
      expect(parseDateCell(46326.75)).toBe("2026-10-31");
    });

    it.each([0, 1, 500, 12.5, -5, 100000, Number.NaN, Number.POSITIVE_INFINITY])(
      "doesn't mistake the number %s for a date",
      (value) => {
        expect(parseDateCell(value)).toBeNull();
      },
    );
  });

  describe("everything else", () => {
    it.each([
      null,
      undefined,
      true,
      "",
      "   ",
      "soon",
      "Date",
      "12.50",
      "2026",
      "31/10",
      "31/10/2026/1",
      "a31/10/2026",
      "31/10/2026 extra",
    ])("is not a date: %j", (value) => {
      expect(parseDateCell(value)).toBeNull();
    });
  });
});

describe("parseAmountCell", () => {
  describe("numbers", () => {
    it.each([
      [12.5, 12.5],
      [100, 100],
      [0, 0],
      [0.01, 0.01],
      [1234567.89, 1234567.89],
    ])("keeps %s", (value, expected) => {
      expect(parseAmountCell(value)).toBe(expected);
    });

    it("drops the sign: every row is an expense", () => {
      expect(parseAmountCell(-45.5)).toBe(45.5);
    });

    it("rounds to cents", () => {
      expect(parseAmountCell(12.345)).toBe(12.35);
      expect(parseAmountCell(0.1 + 0.2)).toBe(0.3);
      expect(parseAmountCell(19.999)).toBe(20);
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY])("rejects %s", (value) => {
      expect(parseAmountCell(value)).toBeNull();
    });
  });

  describe("text amounts", () => {
    it.each([
      ["12.50", 12.5],
      ["12", 12],
      ["0.99", 0.99],
      [".5", 0.5],
      ["1,234.56", 1234.56],
      ["1,234,567.89", 1234567.89],
      ["1.234,56", 1234.56],
      ["1.234.567,89", 1234567.89],
      ["1 234,56", 1234.56],
      ["1\u00a0234,56", 1234.56],
      ["12,5", 12.5],
      ["12,50", 12.5],
      ["1,234", 1234],
      ["1,234,567", 1234567],
      ["1.234.567", 1234567],
      ["  45  ", 45],
    ])("reads %j as %s", (text, expected) => {
      expect(parseAmountCell(text)).toBe(expected);
    });

    it.each([
      ["-45.50", 45.5],
      ["45.50-", 45.5],
      ["(120.00)", 120],
      ["−45.50", 45.5],
      ["–45.50", 45.5],
      ["+45.50", 45.5],
      ["-1,234.56", 1234.56],
    ])("ignores the sign of %j", (text, expected) => {
      expect(parseAmountCell(text)).toBe(expected);
    });

    it.each([
      ["₪45", 45],
      ["₪ 45.50", 45.5],
      ["45 ₪", 45],
      ["45.50 ש\"ח", 45.5],
      ["45 שח", 45],
      ["NIS 45", 45],
      ["45 ILS", 45],
      ["$12.50", 12.5],
      ["€12,50", 12.5],
      ["\u200f45.50\u200f", 45.5],
      ["\u200e-45.50 ₪", 45.5],
    ])("ignores the currency and invisible marks in %j", (text, expected) => {
      expect(parseAmountCell(text)).toBe(expected);
    });

    it("rounds extra decimals to cents", () => {
      expect(parseAmountCell("12.345")).toBe(12.35);
      expect(parseAmountCell("0.004")).toBe(0);
    });

    it("reads zero as zero", () => {
      expect(parseAmountCell("0")).toBe(0);
      expect(parseAmountCell("0.00")).toBe(0);
      expect(parseAmountCell("-0")).toBe(0);
    });

    it.each([
      "",
      "   ",
      "abc",
      "12abc",
      "1e3",
      "1,2345",
      "12/10/2026",
      ".",
      ",",
      "--",
      "₪",
      "1.2.3,4",
      "Total",
    ])("is not an amount: %j", (text) => {
      expect(parseAmountCell(text)).toBeNull();
    });
  });

  describe("everything else", () => {
    it.each([null, undefined, true, false, new Date("2026-10-31T00:00:00Z")])("is not an amount: %j", (value) => {
      expect(parseAmountCell(value)).toBeNull();
    });
  });
});
