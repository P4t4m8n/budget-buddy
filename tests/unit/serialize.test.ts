import { Decimal } from "@prisma/client/runtime/client";
import { describe, expect, it } from "vitest";
import { fromDateString, toDateString, toNumber } from "@/lib/data/serialize";

describe("toNumber", () => {
  it("converts a Decimal exactly", () => {
    expect(toNumber(new Decimal("1234.56"))).toBe(1234.56);
    expect(toNumber(new Decimal("0.10"))).toBe(0.1);
    expect(toNumber(new Decimal("9999999999.99"))).toBe(9999999999.99);
  });
});

describe("toDateString / fromDateString", () => {
  it("round-trips a calendar date", () => {
    expect(toDateString(fromDateString("2026-10-29"))).toBe("2026-10-29");
    expect(toDateString(fromDateString("2024-02-29"))).toBe("2024-02-29");
  });

  it("stores dates at UTC midnight, so the day never shifts with the server's timezone", () => {
    expect(fromDateString("2026-10-29").toISOString()).toBe("2026-10-29T00:00:00.000Z");
  });

  it("formats a Date the way Prisma returns @db.Date values", () => {
    expect(toDateString(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01");
  });
});
