import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);

import { getDashboard } from "@/lib/data/dashboard";
import { prisma } from "@/lib/prisma";
import { createUser, deleteTestUsers, signInAs, signOut } from "./support";

// Fixed "now": Oct 29 2026 in Israel, so "this month" is 2026-10
const NOW = new Date("2026-10-29T10:00:00Z");

let alice: { id: string };
let bob: { id: string };
let aliceCategories: Record<string, string>;

const categoryOf = async (userId: string, name: string, type: "INCOME" | "EXPENSE", color = "#f59e0b") =>
  (await prisma.category.create({ data: { userId, name, type, color } })).id;

type Seed = {
  userId?: string;
  category: string;
  type?: "INCOME" | "EXPENSE";
  amount: number | string;
  date: string;
  description?: string;
  currency?: "ILS" | "USD";
  createdAt?: Date;
};

const seed = async (rows: Seed[]) => {
  for (const row of rows) {
    await prisma.transaction.create({
      data: {
        userId: row.userId ?? alice.id,
        categoryId: row.category,
        type: row.type ?? "EXPENSE",
        amount: row.amount,
        currency: row.currency ?? "ILS",
        description: row.description ?? "seeded",
        date: new Date(`${row.date}T00:00:00Z`),
        createdAt: row.createdAt,
      },
    });
  }
};

beforeEach(async () => {
  alice = await createUser("alice");
  bob = await createUser("bob");
  aliceCategories = {
    salary: await categoryOf(alice.id, "Salary", "INCOME", "#10b981"),
    food: await categoryOf(alice.id, "Groceries", "EXPENSE", "#f59e0b"),
    rent: await categoryOf(alice.id, "Rent", "EXPENSE", "#6366f1"),
    fun: await categoryOf(alice.id, "Fun", "EXPENSE", "#ec4899"),
  };
  await signInAs(alice);
});

afterEach(deleteTestUsers);
afterAll(() => prisma.$disconnect());

describe("getDashboard", () => {
  it("is all zeros and empty lists for a user without transactions", async () => {
    const dashboard = await getDashboard({ now: NOW });

    expect(dashboard).toMatchObject({
      month: "2026-10",
      balance: 0,
      income: 0,
      spending: 0,
      spendingByCategory: [],
      recent: [],
    });
    expect(dashboard.monthlyTotals).toHaveLength(6);
    expect(dashboard.monthlyTotals.every((m) => m.income === 0 && m.expenses === 0)).toBe(true);
  });

  it("sums this month's income and spending, and the all-time balance", async () => {
    await seed([
      { category: aliceCategories.salary, type: "INCOME", amount: 7200, date: "2026-10-01" },
      { category: aliceCategories.salary, type: "INCOME", amount: "1100.50", date: "2026-10-12" },
      { category: aliceCategories.rent, amount: 2400, date: "2026-10-02" },
      { category: aliceCategories.food, amount: "430.25", date: "2026-10-04" },
      // Earlier months count towards the balance but not this month
      { category: aliceCategories.salary, type: "INCOME", amount: 7200, date: "2026-09-01" },
      { category: aliceCategories.rent, amount: 2400, date: "2026-09-02" },
      { category: aliceCategories.salary, type: "INCOME", amount: 500, date: "2025-01-15" },
    ]);

    const dashboard = await getDashboard({ now: NOW });

    expect(dashboard.income).toBe(8300.5);
    expect(dashboard.spending).toBe(2830.25);
    // income 7200 + 1100.50 + 7200 + 500 = 16000.50; expenses 2400 + 430.25 + 2400 = 5230.25
    expect(dashboard.balance).toBe(10770.25);
  });

  it("can have a negative balance", async () => {
    await seed([{ category: aliceCategories.rent, amount: 100, date: "2026-10-02" }]);

    expect((await getDashboard({ now: NOW })).balance).toBe(-100);
  });

  it("adds cents exactly instead of accumulating floating point noise", async () => {
    await seed([
      { category: aliceCategories.food, amount: "0.10", date: "2026-10-02" },
      { category: aliceCategories.food, amount: "0.20", date: "2026-10-03" },
      { category: aliceCategories.salary, type: "INCOME", amount: "0.30", date: "2026-10-04" },
    ]);

    const dashboard = await getDashboard({ now: NOW });

    expect(dashboard.spending).toBe(0.3);
    expect(dashboard.balance).toBe(0);
    expect(dashboard.spendingByCategory[0].value).toBe(0.3);
  });

  describe("month boundaries", () => {
    it("includes the first and last day of the month and nothing from the neighbours", async () => {
      await seed([
        { category: aliceCategories.food, amount: 1, date: "2026-09-30" },
        { category: aliceCategories.food, amount: 10, date: "2026-10-01" },
        { category: aliceCategories.food, amount: 100, date: "2026-10-31" },
        { category: aliceCategories.food, amount: 1000, date: "2026-11-01" },
      ]);

      const dashboard = await getDashboard({ now: NOW });

      expect(dashboard.spending).toBe(110);
      expect(dashboard.spendingByCategory).toEqual([
        { id: aliceCategories.food, label: "Groceries", color: "#f59e0b", value: 110 },
      ]);
    });

    it("moves to the next month at midnight in Israel, not in UTC", async () => {
      await seed([
        { category: aliceCategories.food, amount: 10, date: "2026-10-31" },
        { category: aliceCategories.food, amount: 100, date: "2026-11-01" },
      ]);

      // 22:30 UTC on Oct 31 is already Nov 1 in Israel
      const dashboard = await getDashboard({ now: new Date("2026-10-31T22:30:00Z") });

      expect(dashboard.month).toBe("2026-11");
      expect(dashboard.spending).toBe(100);
    });

    it("does not count transactions after this month in the chart, but they stay in the balance", async () => {
      await seed([{ category: aliceCategories.food, amount: 50, date: "2026-12-05" }]);

      const dashboard = await getDashboard({ now: NOW });

      expect(dashboard.monthlyTotals.map((m) => m.month)).not.toContain("2026-12");
      expect(dashboard.monthlyTotals.every((m) => m.expenses === 0)).toBe(true);
      expect(dashboard.balance).toBe(-50);
    });
  });

  describe("spending by category", () => {
    it("groups this month's expenses by category, biggest first, with names and colors", async () => {
      await seed([
        { category: aliceCategories.food, amount: 100, date: "2026-10-03" },
        { category: aliceCategories.food, amount: "50.5", date: "2026-10-20" },
        { category: aliceCategories.rent, amount: 2400, date: "2026-10-02" },
        { category: aliceCategories.fun, amount: 80, date: "2026-10-18" },
      ]);

      const { spendingByCategory } = await getDashboard({ now: NOW });

      expect(spendingByCategory).toEqual([
        { id: aliceCategories.rent, label: "Rent", color: "#6366f1", value: 2400 },
        { id: aliceCategories.food, label: "Groceries", color: "#f59e0b", value: 150.5 },
        { id: aliceCategories.fun, label: "Fun", color: "#ec4899", value: 80 },
      ]);
    });

    it("leaves out income, other months and categories without spending", async () => {
      await seed([
        { category: aliceCategories.salary, type: "INCOME", amount: 7200, date: "2026-10-01" },
        { category: aliceCategories.food, amount: 999, date: "2026-09-10" },
        { category: aliceCategories.rent, amount: 10, date: "2026-10-02" },
      ]);

      const { spendingByCategory } = await getDashboard({ now: NOW });

      expect(spendingByCategory.map((s) => s.label)).toEqual(["Rent"]);
    });
  });

  describe("income vs. expenses over the last six months", () => {
    it("lists six months, oldest first, with zeros for months without transactions", async () => {
      await seed([
        { category: aliceCategories.salary, type: "INCOME", amount: 7200, date: "2026-08-01" },
        { category: aliceCategories.rent, amount: 2400, date: "2026-08-02" },
        { category: aliceCategories.food, amount: 300, date: "2026-10-10" },
      ]);

      const { monthlyTotals } = await getDashboard({ now: NOW });

      expect(monthlyTotals).toEqual([
        { month: "2026-05", income: 0, expenses: 0 },
        { month: "2026-06", income: 0, expenses: 0 },
        { month: "2026-07", income: 0, expenses: 0 },
        { month: "2026-08", income: 7200, expenses: 2400 },
        { month: "2026-09", income: 0, expenses: 0 },
        { month: "2026-10", income: 0, expenses: 300 },
      ]);
    });

    it("ignores months older than the window, but keeps them in the balance", async () => {
      await seed([
        { category: aliceCategories.salary, type: "INCOME", amount: 1000, date: "2026-04-30" },
        { category: aliceCategories.salary, type: "INCOME", amount: 20, date: "2026-05-01" },
      ]);

      const dashboard = await getDashboard({ now: NOW });

      expect(dashboard.monthlyTotals[0]).toEqual({ month: "2026-05", income: 20, expenses: 0 });
      expect(dashboard.balance).toBe(1020);
    });

    it("crosses the turn of the year", async () => {
      await seed([
        { category: aliceCategories.food, amount: 5, date: "2025-12-31" },
        { category: aliceCategories.food, amount: 7, date: "2026-01-01" },
      ]);

      const { monthlyTotals } = await getDashboard({ now: new Date("2026-02-10T10:00:00Z") });

      expect(monthlyTotals.map((m) => m.month)).toEqual([
        "2025-09",
        "2025-10",
        "2025-11",
        "2025-12",
        "2026-01",
        "2026-02",
      ]);
      expect(monthlyTotals[3].expenses).toBe(5);
      expect(monthlyTotals[4].expenses).toBe(7);
    });

    it("matches the cards for the current month", async () => {
      await seed([
        { category: aliceCategories.salary, type: "INCOME", amount: 7200, date: "2026-10-01" },
        { category: aliceCategories.rent, amount: 2400, date: "2026-10-02" },
      ]);

      const dashboard = await getDashboard({ now: NOW });
      const last = dashboard.monthlyTotals.at(-1);

      expect(last).toEqual({ month: "2026-10", income: dashboard.income, expenses: dashboard.spending });
    });
  });

  describe("recent transactions", () => {
    it("returns the six newest with their category names", async () => {
      await seed(
        Array.from({ length: 8 }, (_, i) => ({
          category: aliceCategories.food,
          amount: i + 1,
          date: `2026-10-${String(i + 1).padStart(2, "0")}`,
          description: `Day ${i + 1}`,
        })),
      );

      const { recent } = await getDashboard({ now: NOW });

      expect(recent.map((t) => t.description)).toEqual([
        "Day 8",
        "Day 7",
        "Day 6",
        "Day 5",
        "Day 4",
        "Day 3",
      ]);
      expect(recent[0]).toMatchObject({ categoryName: "Groceries", amount: 8, date: "2026-10-08" });
    });

    it("puts the one created last first when two share a date", async () => {
      await seed([
        { category: aliceCategories.food, amount: 1, date: "2026-10-05", description: "first", createdAt: new Date("2026-10-05T08:00:00Z") },
        { category: aliceCategories.food, amount: 2, date: "2026-10-05", description: "second", createdAt: new Date("2026-10-05T09:00:00Z") },
      ]);

      expect((await getDashboard({ now: NOW })).recent.map((t) => t.description)).toEqual(["second", "first"]);
    });
  });

  describe("currencies", () => {
    it("never adds amounts in another currency to the ILS totals", async () => {
      await seed([
        { category: aliceCategories.rent, amount: 100, date: "2026-10-02" },
        { category: aliceCategories.rent, amount: 9999, date: "2026-10-03", currency: "USD" },
        { category: aliceCategories.salary, type: "INCOME", amount: 8888, date: "2026-10-04", currency: "USD" },
      ]);

      const dashboard = await getDashboard({ now: NOW });

      expect(dashboard.spending).toBe(100);
      expect(dashboard.income).toBe(0);
      expect(dashboard.balance).toBe(-100);
      expect(dashboard.spendingByCategory).toHaveLength(1);
      expect(dashboard.monthlyTotals.at(-1)).toEqual({ month: "2026-10", income: 0, expenses: 100 });
    });
  });

  describe("isolation", () => {
    it("only counts the signed-in user's transactions, in every number on the page", async () => {
      await seed([{ category: aliceCategories.food, amount: 100, date: "2026-10-03", description: "alice's" }]);
      const bobFood = await categoryOf(bob.id, "Food", "EXPENSE", "#ff0000");
      const bobPay = await categoryOf(bob.id, "Pay", "INCOME", "#00ff00");
      await seed([
        { userId: bob.id, category: bobFood, amount: 5000, date: "2026-10-03", description: "bob's" },
        { userId: bob.id, category: bobPay, type: "INCOME", amount: 90000, date: "2026-10-01", description: "bob's pay" },
      ]);

      const dashboard = await getDashboard({ now: NOW });

      expect(dashboard.balance).toBe(-100);
      expect(dashboard.income).toBe(0);
      expect(dashboard.spending).toBe(100);
      expect(dashboard.spendingByCategory.map((s) => s.label)).toEqual(["Groceries"]);
      expect(dashboard.monthlyTotals.at(-1)).toEqual({ month: "2026-10", income: 0, expenses: 100 });
      expect(dashboard.recent.map((t) => t.description)).toEqual(["alice's"]);

      await signInAs(bob);
      const bobs = await getDashboard({ now: NOW });
      expect(bobs.balance).toBe(85000);
      expect(bobs.recent.map((t) => t.description)).toEqual(["bob's", "bob's pay"]);
    });
  });

  it("returns plain data that can be sent to the browser", async () => {
    await seed([{ category: aliceCategories.food, amount: "12.50", date: "2026-10-03" }]);

    const dashboard = await getDashboard({ now: NOW });

    expect(JSON.parse(JSON.stringify(dashboard))).toEqual(dashboard);
    expect(typeof dashboard.balance).toBe("number");
    expect(typeof dashboard.monthlyTotals[0].income).toBe("number");
  });

  it("uses the real current time when none is given", async () => {
    const dashboard = await getDashboard();

    expect(dashboard.month).toMatch(/^\d{4}-\d{2}$/);
    expect(dashboard.monthlyTotals).toHaveLength(6);
    expect(dashboard.monthlyTotals.at(-1)?.month).toBe(dashboard.month);
  });

  it("sends signed-out visitors to /login", async () => {
    signOut();

    await expect(getDashboard({ now: NOW })).rejects.toMatchObject({
      digest: expect.stringContaining("/login"),
    });
  });
});
