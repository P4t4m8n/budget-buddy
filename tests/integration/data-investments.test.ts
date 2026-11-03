import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);

import {
  createInvestment,
  deleteInvestment,
  getInvestmentsOverview,
  updateInvestment,
  updateInvestmentValue,
} from "@/lib/data/investments";
import { prisma } from "@/lib/prisma";
import { appError } from "../setup/app-error";
import { createUser, deleteTestUsers, signInAs, signOut } from "./support";

// Fixed "now": Oct 29 2026 in Israel
const NOW = new Date("2026-10-29T10:00:00Z");
const day = (date: string) => new Date(`${date}T00:00:00Z`);

let alice: { id: string };
let bob: { id: string };

const input = (overrides: Partial<Parameters<typeof createInvestment>[0]> = {}) => ({
  name: "S&P 500 ETF",
  type: "ETF" as const,
  ticker: "VOO",
  amountInvested: 8000,
  currentValue: 9150.5,
  currency: "ILS" as const,
  purchaseDate: "2025-03-10",
  ...overrides,
});

const update = (overrides: Partial<Parameters<typeof updateInvestment>[1]> = {}) => ({
  name: "S&P 500 ETF",
  type: "ETF" as const,
  ticker: "VOO",
  amountInvested: 8000,
  currency: "ILS" as const,
  purchaseDate: "2025-03-10",
  ...overrides,
});

type Seed = {
  userId?: string;
  name: string;
  type?: "STOCK" | "ETF" | "CRYPTO" | "BOND" | "OTHER";
  ticker?: string | null;
  invested?: number | string;
  value?: number | string;
  currency?: "ILS" | "USD";
};

const seed = async ({ userId, name, type, ticker, invested, value, currency }: Seed) =>
  (
    await prisma.investment.create({
      data: {
        userId: userId ?? alice.id,
        name,
        type: type ?? "ETF",
        ticker: ticker ?? null,
        amountInvested: invested ?? 1000,
        currentValue: value ?? 1000,
        currency: currency ?? "ILS",
        purchaseDate: day("2025-01-01"),
      },
    })
  ).id;

const snapshot = (investmentId: string, date: string, value: number | string, userId = alice.id) =>
  prisma.investmentSnapshot.create({ data: { userId, investmentId, date: day(date), value } });

const snapshotsOf = async (investmentId: string) =>
  (await prisma.investmentSnapshot.findMany({ where: { investmentId }, orderBy: { date: "asc" } })).map((s) => ({
    date: s.date.toISOString().slice(0, 10),
    value: s.value.toString(),
  }));

beforeEach(async () => {
  alice = await createUser("alice");
  bob = await createUser("bob");
  await signInAs(alice);
});

afterEach(deleteTestUsers);
afterAll(() => prisma.$disconnect());

describe("getInvestmentsOverview", () => {
  it("is empty for a new user", async () => {
    expect(await getInvestmentsOverview()).toEqual({
      investments: [],
      totalInvested: 0,
      portfolioValue: 0,
      gain: 0,
      history: { dates: [], series: [] },
    });
  });

  it("lists investments by name as plain data, with their return and how many values are recorded", async () => {
    const etf = await seed({ name: "World ETF", ticker: "VWRL", invested: 5000, value: "5420.50" });
    const apple = await seed({ name: "Apple", type: "STOCK", ticker: "AAPL", invested: 2000, value: 2480 });
    await snapshot(etf, "2026-09-01", 5000);
    await snapshot(etf, "2026-10-01", "5420.50");

    const { investments } = await getInvestmentsOverview();

    expect(investments).toEqual([
      {
        id: apple,
        name: "Apple",
        type: "STOCK",
        ticker: "AAPL",
        amountInvested: 2000,
        currentValue: 2480,
        currency: "ILS",
        purchaseDate: "2025-01-01",
        gainPercent: 24,
        snapshotCount: 0,
      },
      {
        id: etf,
        name: "World ETF",
        type: "ETF",
        ticker: "VWRL",
        amountInvested: 5000,
        currentValue: 5420.5,
        currency: "ILS",
        purchaseDate: "2025-01-01",
        gainPercent: 8.41,
        snapshotCount: 2,
      },
    ]);
    expect(JSON.parse(JSON.stringify(investments))).toEqual(investments);
  });

  it("shows a loss as a negative return, and a total loss as -100%", async () => {
    await seed({ name: "Bitcoin", type: "CRYPTO", invested: 1500, value: 1320 });
    await seed({ name: "Dead coin", type: "CRYPTO", invested: 100, value: 0 });

    const { investments } = await getInvestmentsOverview();

    expect(investments.map((i) => [i.name, i.gainPercent])).toEqual([
      ["Bitcoin", -12],
      ["Dead coin", -100],
    ]);
  });

  it("doesn't divide by zero for an investment that has nothing invested", async () => {
    await seed({ name: "Gift", invested: 0, value: 50 });

    expect((await getInvestmentsOverview()).investments[0].gainPercent).toBe(0);
  });

  it("adds up exactly, to the cent, and works out the total gain", async () => {
    await seed({ name: "A", invested: "0.10", value: "0.30" });
    await seed({ name: "B", invested: "0.20", value: "0.10" });
    await seed({ name: "C", invested: "1000.05", value: "1200.15" });

    const overview = await getInvestmentsOverview();

    expect(overview.totalInvested).toBe(1000.35);
    expect(overview.portfolioValue).toBe(1200.55);
    expect(overview.gain).toBe(200.2);
  });

  it("can have a negative total gain", async () => {
    await seed({ name: "A", invested: 1000, value: 400 });

    expect((await getInvestmentsOverview()).gain).toBe(-600);
  });

  it("only adds up ILS investments", async () => {
    await seed({ name: "Local", invested: 1000, value: 1100 });
    await seed({ name: "Abroad", invested: 50, value: 60, currency: "USD" });

    const overview = await getInvestmentsOverview();

    expect(overview.investments).toHaveLength(2);
    expect([overview.totalInvested, overview.portfolioValue, overview.gain]).toEqual([1000, 1100, 100]);
  });

  describe("history", () => {
    it("has every date that has a value, oldest first, and a line per investment with a gap where it has none", async () => {
      const apple = await seed({ name: "Apple" });
      const btc = await seed({ name: "Bitcoin" });
      await snapshot(btc, "2026-10-20", 30);
      await snapshot(apple, "2026-09-01", 100);
      await snapshot(apple, "2026-10-20", "110.50");
      await snapshot(btc, "2026-10-05", 20);

      const { history } = await getInvestmentsOverview();

      expect(history).toEqual({
        dates: ["2026-09-01", "2026-10-05", "2026-10-20"],
        series: [
          { id: apple, label: "Apple", data: [100, null, 110.5] },
          { id: btc, label: "Bitcoin", data: [null, 20, 30] },
        ],
      });
    });

    it("leaves out an investment that has no recorded values, though it is still listed", async () => {
      const apple = await seed({ name: "Apple" });
      await seed({ name: "Bare" });
      await snapshot(apple, "2026-10-01", 100);

      const overview = await getInvestmentsOverview();

      expect(overview.investments.map((i) => i.name)).toEqual(["Apple", "Bare"]);
      expect(overview.history.series.map((s) => s.label)).toEqual(["Apple"]);
    });

    it("is only the signed-in user's", async () => {
      const mine = await seed({ name: "Mine" });
      const bobs = await seed({ userId: bob.id, name: "Bob's" });
      await snapshot(mine, "2026-10-01", 1);
      await snapshot(bobs, "2026-10-02", 2, bob.id);

      const { history } = await getInvestmentsOverview();

      expect(history.dates).toEqual(["2026-10-01"]);
      expect(history.series.map((s) => s.label)).toEqual(["Mine"]);
    });
  });

  it("only returns the signed-in user's investments", async () => {
    await seed({ name: "Mine", invested: 100, value: 100 });
    await seed({ userId: bob.id, name: "Bob's", invested: 999, value: 999 });

    expect((await getInvestmentsOverview()).investments.map((i) => i.name)).toEqual(["Mine"]);
    await signInAs(bob);
    expect((await getInvestmentsOverview()).totalInvested).toBe(999);
  });

  it("sends signed-out callers to /login", async () => {
    signOut();

    await expect(getInvestmentsOverview()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });
});

describe("createInvestment", () => {
  it("creates an investment owned by the signed-in user", async () => {
    const created = await createInvestment(input({ amountInvested: 8000.25 }), { now: NOW });

    const [row] = await prisma.investment.findMany({ where: { userId: alice.id } });
    expect(row).toMatchObject({ id: created.id, name: "S&P 500 ETF", type: "ETF", ticker: "VOO", currency: "ILS" });
    expect(row.amountInvested.toString()).toBe("8000.25");
    expect(row.currentValue.toString()).toBe("9150.5");
    expect(row.purchaseDate.toISOString()).toBe("2025-03-10T00:00:00.000Z");
    expect(created).toEqual({
      id: row.id,
      name: "S&P 500 ETF",
      type: "ETF",
      ticker: "VOO",
      amountInvested: 8000.25,
      currentValue: 9150.5,
      currency: "ILS",
      purchaseDate: "2025-03-10",
    });
    expect(await prisma.investment.count({ where: { userId: bob.id } })).toBe(0);
  });

  it("records the starting value as the first point of its history, on the user's day", async () => {
    const lateOctoberUtc = new Date("2026-10-31T22:30:00Z");

    const { id } = await createInvestment(input({ currentValue: 9150.5 }), { now: lateOctoberUtc });

    // Already November 1st in Israel
    expect(await snapshotsOf(id)).toEqual([{ date: "2026-11-01", value: "9150.5" }]);
    const [snapshotRow] = await prisma.investmentSnapshot.findMany({ where: { investmentId: id } });
    expect(snapshotRow.userId).toBe(alice.id);
  });

  it("can start worth nothing, and without a ticker", async () => {
    const { id, ticker } = await createInvestment(input({ ticker: null, currentValue: 0 }), { now: NOW });

    expect(ticker).toBeNull();
    expect(await snapshotsOf(id)).toEqual([{ date: "2026-10-29", value: "0" }]);
  });

  it("uses the real current time when none is given", async () => {
    const { id } = await createInvestment(input());

    const [{ date }] = await snapshotsOf(id);
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("sends signed-out callers to /login", async () => {
    signOut();

    await expect(createInvestment(input())).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
    expect(await prisma.investment.count()).toBe(0);
    expect(await prisma.investmentSnapshot.count()).toBe(0);
  });
});

describe("updateInvestment", () => {
  it("changes the details, and leaves the current value and the history alone", async () => {
    const id = await seed({ name: "Old", ticker: "OLD", invested: 1000, value: 1500 });
    await snapshot(id, "2026-10-01", 1500);

    const updated = await updateInvestment(
      id,
      update({ name: "New", type: "STOCK", ticker: null, amountInvested: 1200.5, purchaseDate: "2024-05-05" }),
    );

    expect(updated).toEqual({
      id,
      name: "New",
      type: "STOCK",
      ticker: null,
      amountInvested: 1200.5,
      currentValue: 1500,
      currency: "ILS",
      purchaseDate: "2024-05-05",
    });
    expect(await snapshotsOf(id)).toEqual([{ date: "2026-10-01", value: "1500" }]);
  });

  it("can't change another user's investment, even with its id", async () => {
    const bobs = await seed({ userId: bob.id, name: "Bob's" });

    await expect(updateInvestment(bobs, update({ name: "Hijacked" }))).rejects.toMatchObject(appError("NOT_FOUND"));

    expect(await prisma.investment.findUniqueOrThrow({ where: { id: bobs } })).toMatchObject({ name: "Bob's" });
  });

  it("reports an investment that doesn't exist", async () => {
    await expect(updateInvestment("missing", update())).rejects.toMatchObject(appError("NOT_FOUND"));
  });

  it("sends signed-out callers to /login", async () => {
    const id = await seed({ name: "Mine" });
    signOut();

    await expect(updateInvestment(id, update())).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });
});

describe("updateInvestmentValue", () => {
  it("sets the current value and records it as today's value", async () => {
    const id = await seed({ name: "Apple", value: 2000 });

    const updated = await updateInvestmentValue(id, { value: 2480.25 }, { now: NOW });

    expect(updated).toMatchObject({ id, currentValue: 2480.25, name: "Apple" });
    expect((await prisma.investment.findUniqueOrThrow({ where: { id } })).currentValue.toString()).toBe("2480.25");
    expect(await snapshotsOf(id)).toEqual([{ date: "2026-10-29", value: "2480.25" }]);
    const [row] = await prisma.investmentSnapshot.findMany({ where: { investmentId: id } });
    expect(row.userId).toBe(alice.id);
  });

  it("replaces the value when it is updated again the same day, instead of adding another", async () => {
    const id = await seed({ name: "Apple" });
    await updateInvestmentValue(id, { value: 100 }, { now: NOW });

    await updateInvestmentValue(id, { value: 120.5 }, { now: new Date("2026-10-29T18:00:00Z") });

    expect(await snapshotsOf(id)).toEqual([{ date: "2026-10-29", value: "120.5" }]);
    expect((await getInvestmentsOverview()).investments[0].currentValue).toBe(120.5);
  });

  it("adds a point when it is updated on another day, and keeps the earlier ones", async () => {
    const id = await seed({ name: "Apple" });
    await updateInvestmentValue(id, { value: 100 }, { now: NOW });

    await updateInvestmentValue(id, { value: 110 }, { now: new Date("2026-10-30T10:00:00Z") });

    expect(await snapshotsOf(id)).toEqual([
      { date: "2026-10-29", value: "100" },
      { date: "2026-10-30", value: "110" },
    ]);
  });

  it("counts the day in the user's timezone", async () => {
    const id = await seed({ name: "Apple" });
    await updateInvestmentValue(id, { value: 100 }, { now: new Date("2026-10-31T21:30:00Z") });
    await updateInvestmentValue(id, { value: 105 }, { now: new Date("2026-10-31T22:30:00Z") });

    // 23:30 on Oct 31 and 00:30 on Nov 1 in Israel: two different days
    expect(await snapshotsOf(id)).toEqual([
      { date: "2026-10-31", value: "100" },
      { date: "2026-11-01", value: "105" },
    ]);
  });

  it("can set the value to zero", async () => {
    const id = await seed({ name: "Dead coin", value: 100 });

    await updateInvestmentValue(id, { value: 0 }, { now: NOW });

    expect((await getInvestmentsOverview()).investments[0]).toMatchObject({ currentValue: 0, gainPercent: -100 });
  });

  it("feeds the overview: totals, return and history", async () => {
    const id = await seed({ name: "Apple", invested: 2000, value: 2000 });
    await updateInvestmentValue(id, { value: 2500 }, { now: NOW });

    const overview = await getInvestmentsOverview();

    expect(overview.portfolioValue).toBe(2500);
    expect(overview.gain).toBe(500);
    expect(overview.investments[0]).toMatchObject({ gainPercent: 25, snapshotCount: 1 });
    expect(overview.history).toEqual({ dates: ["2026-10-29"], series: [{ id, label: "Apple", data: [2500] }] });
  });

  it("stays consistent when updates race: one value for the day, and it is the current value", async () => {
    const id = await seed({ name: "Apple" });

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) => updateInvestmentValue(id, { value: 100 + i }, { now: NOW })),
    );

    expect(results.filter((r) => r.status === "rejected")).toEqual([]);
    const [only, ...others] = await snapshotsOf(id);
    expect(others).toEqual([]);
    const current = await prisma.investment.findUniqueOrThrow({ where: { id } });
    expect(current.currentValue.toString()).toBe(only.value);
  });

  it("can't update another user's investment, even with its id, and records nothing", async () => {
    const bobs = await seed({ userId: bob.id, name: "Bob's", value: 100 });

    await expect(updateInvestmentValue(bobs, { value: 999 }, { now: NOW })).rejects.toMatchObject(
      appError("NOT_FOUND"),
    );

    expect((await prisma.investment.findUniqueOrThrow({ where: { id: bobs } })).currentValue.toString()).toBe("100");
    expect(await prisma.investmentSnapshot.count()).toBe(0);
  });

  it("reports an investment that doesn't exist", async () => {
    await expect(updateInvestmentValue("missing", { value: 1 }, { now: NOW })).rejects.toMatchObject(
      appError("NOT_FOUND"),
    );
  });

  it("sends signed-out callers to /login", async () => {
    const id = await seed({ name: "Apple" });
    signOut();

    await expect(updateInvestmentValue(id, { value: 1 })).rejects.toMatchObject({
      digest: expect.stringContaining("/login"),
    });
    expect(await prisma.investmentSnapshot.count()).toBe(0);
  });
});

describe("deleteInvestment", () => {
  it("deletes the investment and its recorded values, and only those", async () => {
    const gone = await seed({ name: "Gone" });
    const kept = await seed({ name: "Kept" });
    await snapshot(gone, "2026-10-01", 1);
    await snapshot(gone, "2026-10-02", 2);
    await snapshot(kept, "2026-10-01", 3);

    await deleteInvestment(gone);

    expect((await prisma.investment.findMany({ where: { userId: alice.id } })).map((i) => i.name)).toEqual(["Kept"]);
    expect(await prisma.investmentSnapshot.count()).toBe(1);
    expect(await snapshotsOf(kept)).toHaveLength(1);
  });

  it("can't delete another user's investment", async () => {
    const bobs = await seed({ userId: bob.id, name: "Bob's" });
    await snapshot(bobs, "2026-10-01", 1, bob.id);

    await expect(deleteInvestment(bobs)).rejects.toMatchObject(appError("NOT_FOUND"));

    expect(await prisma.investment.count({ where: { id: bobs } })).toBe(1);
    expect(await prisma.investmentSnapshot.count()).toBe(1);
  });

  it("reports an investment that doesn't exist, including one that was already deleted", async () => {
    const id = await seed({ name: "Gone" });
    await deleteInvestment(id);

    await expect(deleteInvestment(id)).rejects.toMatchObject(appError("NOT_FOUND"));
  });
});
