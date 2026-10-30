import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);

import { deleteBudget, getBudgetOverview, setBudget } from "@/lib/data/budgets";
import { prisma } from "@/lib/prisma";
import { appError } from "../setup/app-error";
import { createUser, deleteTestUsers, signInAs, signOut } from "./support";

// Fixed "now": Oct 29 2026 in Israel, so the current month is 2026-10
const NOW = new Date("2026-10-29T10:00:00Z");

let alice: { id: string };
let bob: { id: string };
let food: string;
let rent: string;
let fun: string;
let salary: string;

const category = async (userId: string, name: string, type: "INCOME" | "EXPENSE", color = "#f59e0b") =>
  (await prisma.category.create({ data: { userId, name, type, color } })).id;

type Spend = {
  userId?: string;
  category: string;
  amount: number | string;
  date: string;
  type?: "INCOME" | "EXPENSE";
  currency?: "ILS" | "USD";
};

const spend = async (rows: Spend[]) => {
  for (const row of rows) {
    await prisma.transaction.create({
      data: {
        userId: row.userId ?? alice.id,
        categoryId: row.category,
        type: row.type ?? "EXPENSE",
        amount: row.amount,
        currency: row.currency ?? "ILS",
        description: "seeded",
        date: new Date(`${row.date}T00:00:00Z`),
      },
    });
  }
};

const budgetsOf = (userId: string) => prisma.budget.findMany({ where: { userId } });

const overview = (month?: string) => getBudgetOverview({ month, now: NOW });

beforeEach(async () => {
  alice = await createUser("alice");
  bob = await createUser("bob");
  food = await category(alice.id, "Groceries", "EXPENSE", "#f59e0b");
  rent = await category(alice.id, "Rent", "EXPENSE", "#6366f1");
  fun = await category(alice.id, "Fun", "EXPENSE", "#ec4899");
  salary = await category(alice.id, "Salary", "INCOME", "#10b981");
  await signInAs(alice);
});

afterEach(deleteTestUsers);
afterAll(() => prisma.$disconnect());

describe("setBudget", () => {
  it("creates a budget owned by the signed-in user for the first day of the month", async () => {
    await setBudget({ categoryId: food, month: "2026-10", limit: 1200.5, currency: "ILS" });

    const [row] = await prisma.budget.findMany({ where: { userId: alice.id } });
    expect(row).toMatchObject({ categoryId: food, currency: "ILS" });
    expect(row.limit.toString()).toBe("1200.5");
    expect(row.month.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("changes the limit when the category already has a budget that month, instead of adding a second", async () => {
    await setBudget({ categoryId: food, month: "2026-10", limit: 1000, currency: "ILS" });
    await setBudget({ categoryId: food, month: "2026-10", limit: 1500, currency: "ILS" });

    const rows = await prisma.budget.findMany({ where: { userId: alice.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].limit.toString()).toBe("1500");
  });

  it("keeps each month's budget separate", async () => {
    await setBudget({ categoryId: food, month: "2026-09", limit: 900, currency: "ILS" });
    await setBudget({ categoryId: food, month: "2026-10", limit: 1100, currency: "ILS" });

    expect(await prisma.budget.count({ where: { userId: alice.id } })).toBe(2);
    expect((await overview("2026-09")).rows.find((r) => r.categoryId === food)?.limit).toBe(900);
    expect((await overview("2026-10")).rows.find((r) => r.categoryId === food)?.limit).toBe(1100);
  });

  it("refuses an income category and saves nothing", async () => {
    await expect(
      setBudget({ categoryId: salary, month: "2026-10", limit: 100, currency: "ILS" }),
    ).rejects.toMatchObject({ ...appError("INVALID_REFERENCE"), field: "categoryId" });

    expect(await budgetsOf(alice.id)).toEqual([]);
  });

  it("refuses another user's category and saves nothing", async () => {
    const bobFood = await category(bob.id, "Food", "EXPENSE");

    await expect(
      setBudget({ categoryId: bobFood, month: "2026-10", limit: 100, currency: "ILS" }),
    ).rejects.toMatchObject(appError("INVALID_REFERENCE"));

    expect(await prisma.budget.count()).toBe(0);
  });

  it("refuses a category that doesn't exist", async () => {
    await expect(
      setBudget({ categoryId: "nope", month: "2026-10", limit: 100, currency: "ILS" }),
    ).rejects.toMatchObject(appError("INVALID_REFERENCE"));
  });

  it("can't overwrite another user's budget, even for the same month", async () => {
    await setBudget({ categoryId: food, month: "2026-10", limit: 1000, currency: "ILS" });
    await signInAs(bob);
    const bobFood = await category(bob.id, "Groceries", "EXPENSE");

    await setBudget({ categoryId: bobFood, month: "2026-10", limit: 50, currency: "ILS" });

    expect((await prisma.budget.findFirstOrThrow({ where: { userId: alice.id } })).limit.toString()).toBe("1000");
    expect((await prisma.budget.findFirstOrThrow({ where: { userId: bob.id } })).limit.toString()).toBe("50");
  });

  it("sends signed-out visitors to /login", async () => {
    signOut();

    await expect(
      setBudget({ categoryId: food, month: "2026-10", limit: 100, currency: "ILS" }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
    expect(await prisma.budget.count()).toBe(0);
  });
});

describe("deleteBudget", () => {
  it("deletes one's own budget and nothing else", async () => {
    await setBudget({ categoryId: food, month: "2026-10", limit: 1000, currency: "ILS" });
    await setBudget({ categoryId: rent, month: "2026-10", limit: 2400, currency: "ILS" });
    const [target] = await prisma.budget.findMany({ where: { categoryId: food } });

    await deleteBudget(target.id);

    const left = await prisma.budget.findMany({ where: { userId: alice.id } });
    expect(left.map((b) => b.categoryId)).toEqual([rent]);
  });

  it("can't delete another user's budget, even with its id", async () => {
    await setBudget({ categoryId: food, month: "2026-10", limit: 1000, currency: "ILS" });
    const [target] = await prisma.budget.findMany({ where: { userId: alice.id } });
    await signInAs(bob);

    await expect(deleteBudget(target.id)).rejects.toMatchObject(appError("NOT_FOUND"));
    expect(await prisma.budget.count({ where: { id: target.id } })).toBe(1);
  });

  it("reports an unknown id", async () => {
    await expect(deleteBudget("does-not-exist")).rejects.toMatchObject(appError("NOT_FOUND"));
  });

  it("lets the category be deleted afterwards, since nothing uses it any more", async () => {
    await setBudget({ categoryId: fun, month: "2026-10", limit: 100, currency: "ILS" });
    const [target] = await prisma.budget.findMany({ where: { categoryId: fun } });

    await expect(prisma.category.delete({ where: { id: fun } })).rejects.toThrow();
    await deleteBudget(target.id);

    await expect(prisma.category.delete({ where: { id: fun } })).resolves.toBeDefined();
  });

  it("sends signed-out visitors to /login", async () => {
    signOut();

    await expect(deleteBudget("any")).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });
});

describe("getBudgetOverview", () => {
  it("lists every expense category, without budgets, for a new month", async () => {
    const result = await overview();

    expect(result).toMatchObject({
      month: "2026-10",
      thisMonth: "2026-10",
      totalBudget: 0,
      budgetedSpent: 0,
      unbudgetedSpent: 0,
    });
    expect(result.rows.map((r) => r.name)).toEqual(["Fun", "Groceries", "Rent"]);
    expect(result.rows.every((r) => r.budgetId === null && r.limit === null && r.spent === 0)).toBe(true);
  });

  it("never lists income categories", async () => {
    expect((await overview()).rows.map((r) => r.categoryId)).not.toContain(salary);
  });

  it("is empty for a user without categories", async () => {
    await signInAs(bob);

    expect((await overview()).rows).toEqual([]);
  });

  it("puts each budget next to what was spent that month in its category", async () => {
    await setBudget({ categoryId: food, month: "2026-10", limit: 1200, currency: "ILS" });
    await setBudget({ categoryId: rent, month: "2026-10", limit: 2400, currency: "ILS" });
    await spend([
      { category: food, amount: "430.25", date: "2026-10-04" },
      { category: food, amount: "395", date: "2026-10-27" },
      { category: rent, amount: 2400, date: "2026-10-02" },
      // Other months don't count
      { category: food, amount: 999, date: "2026-09-30" },
      { category: food, amount: 999, date: "2026-11-01" },
    ]);

    const { rows } = await overview();

    expect(rows.find((r) => r.categoryId === food)).toMatchObject({
      name: "Groceries",
      color: "#f59e0b",
      limit: 1200,
      currency: "ILS",
      spent: 825.25,
    });
    expect(rows.find((r) => r.categoryId === rent)).toMatchObject({ limit: 2400, spent: 2400 });
  });

  it("lists budgeted categories first, each group by name", async () => {
    await setBudget({ categoryId: rent, month: "2026-10", limit: 2400, currency: "ILS" });

    const { rows } = await overview();

    expect(rows.map((r) => r.name)).toEqual(["Rent", "Fun", "Groceries"]);
  });

  it("totals the budgets, the spending inside them and the spending outside them", async () => {
    await setBudget({ categoryId: food, month: "2026-10", limit: 1200.5, currency: "ILS" });
    await setBudget({ categoryId: rent, month: "2026-10", limit: 2400, currency: "ILS" });
    await spend([
      { category: food, amount: "300.10", date: "2026-10-04" },
      { category: rent, amount: 2400, date: "2026-10-02" },
      { category: fun, amount: "80.20", date: "2026-10-10" },
    ]);

    const result = await overview();

    expect(result.totalBudget).toBe(3600.5);
    expect(result.budgetedSpent).toBe(2700.1);
    expect(result.unbudgetedSpent).toBe(80.2);
  });

  it("adds cents exactly instead of accumulating floating point noise", async () => {
    await setBudget({ categoryId: food, month: "2026-10", limit: "0.10" as never, currency: "ILS" });
    await setBudget({ categoryId: rent, month: "2026-10", limit: "0.20" as never, currency: "ILS" });
    await spend([
      { category: food, amount: "0.10", date: "2026-10-02" },
      { category: rent, amount: "0.20", date: "2026-10-03" },
    ]);

    const result = await overview();

    expect(result.totalBudget).toBe(0.3);
    expect(result.budgetedSpent).toBe(0.3);
  });

  it("includes the first and last day of the month and nothing from its neighbours", async () => {
    await spend([
      { category: food, amount: 1, date: "2026-09-30" },
      { category: food, amount: 10, date: "2026-10-01" },
      { category: food, amount: 100, date: "2026-10-31" },
      { category: food, amount: 1000, date: "2026-11-01" },
    ]);

    expect((await overview()).rows.find((r) => r.categoryId === food)?.spent).toBe(110);
  });

  it("shows another month when asked, and falls back to the current one for bad input", async () => {
    await spend([
      { category: food, amount: 70, date: "2026-09-15" },
      { category: food, amount: 5, date: "2026-10-15" },
    ]);

    expect((await overview("2026-09")).rows.find((r) => r.categoryId === food)).toMatchObject({ spent: 70 });
    expect((await overview("2026-09")).month).toBe("2026-09");
    for (const bad of ["", "2026-13", "nonsense", "2026-10-01"]) {
      const result = await overview(bad);
      expect(result.month).toBe("2026-10");
      expect(result.rows.find((r) => r.categoryId === food)?.spent).toBe(5);
    }
  });

  it("moves to the next month at midnight in Israel, not in UTC", async () => {
    const result = await getBudgetOverview({ now: new Date("2026-10-31T22:30:00Z") });

    expect(result.month).toBe("2026-11");
    expect(result.thisMonth).toBe("2026-11");
  });

  it("only counts expenses, in ILS", async () => {
    await setBudget({ categoryId: food, month: "2026-10", limit: 1000, currency: "ILS" });
    await spend([
      { category: food, amount: 100, date: "2026-10-04" },
      { category: food, amount: 9999, date: "2026-10-05", currency: "USD" },
      // An income can't normally sit in an expense category, but it still must not count
      { category: food, amount: 8888, date: "2026-10-06", type: "INCOME" },
    ]);

    const result = await overview();

    expect(result.rows.find((r) => r.categoryId === food)?.spent).toBe(100);
    expect(result.budgetedSpent).toBe(100);
  });

  it("only shows the signed-in user's categories, budgets and spending", async () => {
    await setBudget({ categoryId: food, month: "2026-10", limit: 1000, currency: "ILS" });
    await spend([{ category: food, amount: 100, date: "2026-10-04" }]);
    await signInAs(bob);
    const bobFood = await category(bob.id, "Groceries", "EXPENSE");
    await setBudget({ categoryId: bobFood, month: "2026-10", limit: 50, currency: "ILS" });
    await spend([{ userId: bob.id, category: bobFood, amount: 7, date: "2026-10-05" }]);

    const bobs = await overview();
    expect(bobs.rows).toHaveLength(1);
    expect(bobs).toMatchObject({ totalBudget: 50, budgetedSpent: 7, unbudgetedSpent: 0 });

    await signInAs(alice);
    const alices = await overview();
    expect(alices.rows).toHaveLength(3);
    expect(alices).toMatchObject({ totalBudget: 1000, budgetedSpent: 100 });
  });

  it("returns plain data that can be sent to the browser", async () => {
    await setBudget({ categoryId: food, month: "2026-10", limit: 12.5, currency: "ILS" });

    const result = await overview();

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(typeof result.totalBudget).toBe("number");
    expect(typeof result.rows[0].spent).toBe("number");
  });

  it("uses the real current time when none is given", async () => {
    const result = await getBudgetOverview();

    expect(result.month).toBe(result.thisMonth);
    expect(result.month).toMatch(/^\d{4}-\d{2}$/);
  });

  it("sends signed-out visitors to /login", async () => {
    signOut();

    await expect(overview()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });
});

describe("a category with budgets", () => {
  it("can't be deleted, and the error counts the budgets", async () => {
    await setBudget({ categoryId: food, month: "2026-10", limit: 1000, currency: "ILS" });
    await setBudget({ categoryId: food, month: "2026-11", limit: 1000, currency: "ILS" });
    const { deleteCategory } = await import("@/lib/data/categories");

    await expect(deleteCategory(food)).rejects.toMatchObject({
      ...appError("IN_USE"),
      details: { transactions: 0, budgets: 2 },
    });
  });
});
