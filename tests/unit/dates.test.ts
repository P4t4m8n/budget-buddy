import { describe, expect, it } from "vitest";
import {
  addMonths,
  currentMonth,
  monthBounds,
  recentMonths,
} from "@/lib/dates";

describe("currentMonth", () => {
  it("uses the month in the given timezone, not the server's", () => {
    // 22:30 UTC on Oct 31 is already Nov 1 in Israel (UTC+2 after daylight saving ends)
    const lateOctoberUtc = new Date("2026-10-31T22:30:00Z");

    expect(currentMonth(lateOctoberUtc, "UTC")).toBe("2026-10");
    expect(currentMonth(lateOctoberUtc, "Asia/Jerusalem")).toBe("2026-11");
  });

  it("can be behind UTC too", () => {
    // 02:00 UTC on Nov 1 is still Oct 31 in New York
    expect(currentMonth(new Date("2026-11-01T02:00:00Z"), "America/New_York")).toBe("2026-10");
  });

  it("handles the turn of the year", () => {
    expect(currentMonth(new Date("2026-12-31T22:30:00Z"), "Asia/Jerusalem")).toBe("2027-01");
  });

  it("pads single-digit months", () => {
    expect(currentMonth(new Date("2026-03-15T12:00:00Z"), "Asia/Jerusalem")).toBe("2026-03");
  });
});

describe("addMonths", () => {
  it.each([
    ["2026-10", 1, "2026-11"],
    ["2026-12", 1, "2027-01"],
    ["2026-01", -1, "2025-12"],
    ["2026-10", 0, "2026-10"],
    ["2026-10", -5, "2026-05"],
    ["2026-03", -14, "2025-01"],
    ["2026-10", 26, "2028-12"],
  ])("%s %+d months is %s", (month, count, expected) => {
    expect(addMonths(month, count)).toBe(expected);
  });
});

describe("monthBounds", () => {
  it("returns the first day of the month and of the next one", () => {
    expect(monthBounds("2026-10")).toEqual({ start: "2026-10-01", end: "2026-11-01" });
  });

  it("rolls over the year", () => {
    expect(monthBounds("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });

  it("works for February in leap and non-leap years, since it never counts days", () => {
    expect(monthBounds("2024-02")).toEqual({ start: "2024-02-01", end: "2024-03-01" });
    expect(monthBounds("2026-02")).toEqual({ start: "2026-02-01", end: "2026-03-01" });
  });
});

describe("recentMonths", () => {
  it("lists the last months in order, ending with the given one", () => {
    expect(recentMonths("2026-10", 6)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
  });

  it("crosses the turn of the year", () => {
    expect(recentMonths("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("can be just the month itself", () => {
    expect(recentMonths("2026-10", 1)).toEqual(["2026-10"]);
  });
});
