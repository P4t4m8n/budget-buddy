import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);

import {
  deleteBudget,
  deleteGeneralBudget,
  getBudgetOverview,
  setBudget,
  setGeneralBudget,
} from "@/lib/data/budgets";
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

const general = (limit: number | string, month = "2026-10") => ({ month, limit: Number(limit), currency: "ILS" as const });
const monthlyBudgetsOf = (userId: string) => prisma.monthlyBudget.findMany({ where: { userId } });

describe("the general (monthly) budget", () => {
  describe("in the overview", () => {
    it("is null until one is set, and the month's total spending is there anyway", async () => {
      await spend([{ category: food, amount: 120, date: "2026-10-04" }]);

      const result = await overview();

      expect(result.general).toBeNull();
      expect(result.totalSpent).toBe(120);
    });

    it("has the limit, and what is left of it", async () => {
      await setGeneralBudget(general("4000.50"));
      await spend([
        { category: food, amount: "430.25", date: "2026-10-04" },
        { category: rent, amount: 2400, date: "2026-10-02" },
      ]);

      const result = await overview();

      expect(result.totalSpent).toBe(2830.25);
      expect(result.general).toEqual({
        budgetId: expect.any(String),
        limit: 4000.5,
        currency: "ILS",
        remaining: 1170.25,
      });
    });

    it("counts every expense against it: budgeted categories, categories without a budget, and none", async () => {
      await setGeneralBudget(general(1000));
      await setBudget({ categoryId: food, month: "2026-10", limit: 300, currency: "ILS" });
      await spend([
        { category: food, amount: 100, date: "2026-10-04" },
        { category: fun, amount: 50, date: "2026-10-05" },
      ]);

      const result = await overview();

      expect(result.totalSpent).toBe(150);
      expect(result.budgetedSpent).toBe(100);
      expect(result.unbudgetedSpent).toBe(50);
      expect(result.general?.remaining).toBe(850);
    });

    it("isn't changed by income: only expenses use it up", async () => {
      await setGeneralBudget(general(1000));
      await spend([
        { category: food, amount: 100, date: "2026-10-04" },
        { category: salary, type: "INCOME", amount: 7200, date: "2026-10-01" },
      ]);

      const result = await overview();

      expect(result.totalSpent).toBe(100);
      expect(result.general?.remaining).toBe(900);
    });

    it("only counts the month shown, from its first day to its last, and only ILS", async () => {
      await setGeneralBudget(general(1000));
      await spend([
        { category: food, amount: 1, date: "2026-09-30" },
        { category: food, amount: 10, date: "2026-10-01" },
        { category: food, amount: 100, date: "2026-10-31" },
        { category: food, amount: 1000, date: "2026-11-01" },
        { category: food, amount: 5000, date: "2026-10-15", currency: "USD" },
      ]);

      const result = await overview();

      expect(result.totalSpent).toBe(110);
      expect(result.general?.remaining).toBe(890);
    });

    it("goes negative when the month's spending passes it, and is exactly zero when it matches", async () => {
      await setGeneralBudget(general(100));
      await spend([{ category: food, amount: "100.01", date: "2026-10-04" }]);
      expect((await overview()).general?.remaining).toBe(-0.01);

      await prisma.transaction.deleteMany({ where: { userId: alice.id } });
      await spend([{ category: food, amount: 100, date: "2026-10-04" }]);
      expect((await overview()).general?.remaining).toBe(0);
    });

    it("works out the remainder exactly, to the cent", async () => {
      await setGeneralBudget(general("1000.10"));
      await spend([
        { category: food, amount: "0.10", date: "2026-10-02" },
        { category: food, amount: "0.20", date: "2026-10-03" },
      ]);

      const result = await overview();

      expect(result.totalSpent).toBe(0.3);
      expect(result.general?.remaining).toBe(999.8);
    });

    it("is kept apart for each month", async () => {
      await setGeneralBudget(general(900, "2026-09"));
      await setGeneralBudget(general(1100, "2026-10"));

      expect((await overview("2026-09")).general?.limit).toBe(900);
      expect((await overview("2026-10")).general?.limit).toBe(1100);
      expect((await overview("2026-11")).general).toBeNull();
    });

    it("is independent of the category budgets: neither changes the other", async () => {
      await setGeneralBudget(general(1000));
      await setBudget({ categoryId: food, month: "2026-10", limit: 4000, currency: "ILS" });

      const withBoth = await overview();
      expect(withBoth.general?.limit).toBe(1000);
      // The category budgets may add up to more than the general one
      expect(withBoth.totalBudget).toBe(4000);

      await deleteBudget(withBoth.rows.find((r) => r.categoryId === food)!.budgetId!);
      const generalOnly = await overview();
      expect(generalOnly.general?.limit).toBe(1000);
      expect(generalOnly.totalBudget).toBe(0);

      await deleteGeneralBudget(withBoth.general!.budgetId);
      expect((await overview()).general).toBeNull();
    });

    it("doesn't need any category", async () => {
      await signInAs(bob);

      await setGeneralBudget(general(500));

      const result = await overview();
      expect(result.rows).toEqual([]);
      expect(result.general).toMatchObject({ limit: 500, remaining: 500 });
    });

    it("only shows the signed-in user's", async () => {
      await setGeneralBudget(general(1000));
      await signInAs(bob);
      await setGeneralBudget(general(50));
      const bobFood = await category(bob.id, "Food", "EXPENSE");
      await spend([{ userId: bob.id, category: bobFood, amount: 7, date: "2026-10-04" }]);

      expect((await overview()).general).toMatchObject({ limit: 50, remaining: 43 });
      await signInAs(alice);
      expect((await overview()).general).toMatchObject({ limit: 1000, remaining: 1000 });
    });

    it("is plain data that can be sent to the browser", async () => {
      await setGeneralBudget(general("1000.50"));

      const result = await overview();

      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
      expect(typeof result.general?.limit).toBe("number");
      expect(typeof result.general?.remaining).toBe("number");
    });
  });

  describe("setGeneralBudget", () => {
    it("creates a budget owned by the signed-in user, for the first day of the month, with the exact limit", async () => {
      await setGeneralBudget(general("4000.50"));

      const [row] = await monthlyBudgetsOf(alice.id);
      expect(row).toMatchObject({ currency: "ILS" });
      expect(row.limit.toString()).toBe("4000.5");
      expect(row.month.toISOString()).toBe("2026-10-01T00:00:00.000Z");
      expect(await monthlyBudgetsOf(bob.id)).toEqual([]);
    });

    it("changes the limit when the month already has one, instead of adding a second", async () => {
      await setGeneralBudget(general(1000));
      await setGeneralBudget(general(1500));

      const rows = await monthlyBudgetsOf(alice.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].limit.toString()).toBe("1500");
    });

    it("doesn't touch the category budgets", async () => {
      await setBudget({ categoryId: food, month: "2026-10", limit: 300, currency: "ILS" });

      await setGeneralBudget(general(1000));

      expect(await prisma.budget.count({ where: { userId: alice.id } })).toBe(1);
    });

    it("sends signed-out callers to /login", async () => {
      signOut();

      await expect(setGeneralBudget(general(1000))).rejects.toMatchObject({
        digest: expect.stringContaining("/login"),
      });
      expect(await prisma.monthlyBudget.count()).toBe(0);
    });
  });

  describe("deleteGeneralBudget", () => {
    it("removes it, and not the category budgets or the transactions", async () => {
      await setGeneralBudget(general(1000));
      await setBudget({ categoryId: food, month: "2026-10", limit: 300, currency: "ILS" });
      await spend([{ category: food, amount: 100, date: "2026-10-04" }]);
      const { general: existing } = await overview();

      await deleteGeneralBudget(existing!.budgetId);

      expect(await monthlyBudgetsOf(alice.id)).toEqual([]);
      expect(await prisma.budget.count({ where: { userId: alice.id } })).toBe(1);
      expect(await prisma.transaction.count({ where: { userId: alice.id } })).toBe(1);
    });

    it("can't remove another user's, even with its id", async () => {
      await signInAs(bob);
      await setGeneralBudget(general(50));
      const bobsId = (await overview()).general!.budgetId;
      await signInAs(alice);

      await expect(deleteGeneralBudget(bobsId)).rejects.toMatchObject(appError("NOT_FOUND"));

      expect(await monthlyBudgetsOf(bob.id)).toHaveLength(1);
    });

    it("reports a monthly budget that doesn't exist, including one that was already removed", async () => {
      await setGeneralBudget(general(1000));
      const { budgetId } = (await overview()).general!;
      await deleteGeneralBudget(budgetId);

      await expect(deleteGeneralBudget(budgetId)).rejects.toMatchObject(appError("NOT_FOUND"));
      await expect(deleteGeneralBudget("missing")).rejects.toMatchObject(appError("NOT_FOUND"));
    });
  });

  it("goes away with its user", async () => {
    await setGeneralBudget(general(1000));

    await prisma.user.delete({ where: { id: alice.id } });

    expect(await prisma.monthlyBudget.count({ where: { userId: alice.id } })).toBe(0);
  });
});
