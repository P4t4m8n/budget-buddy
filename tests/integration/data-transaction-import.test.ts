import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);

import { getBudgetOverview } from "@/lib/data/budgets";
import { createTransactions, getTransactions } from "@/lib/data/transactions";
import { prisma } from "@/lib/prisma";
import { appError } from "../setup/app-error";
import { createUser, deleteTestUsers, signInAs, signOut } from "./support";

let alice: { id: string };
let bob: { id: string };
let food: string;
let fun: string;
let salary: string;
let bobFood: string;

const category = async (userId: string, name: string, type: "INCOME" | "EXPENSE") =>
  (await prisma.category.create({ data: { userId, name, type, color: "#f59e0b" } })).id;

const row = (categoryId: string, overrides: Partial<{ description: string; amount: number; date: string }> = {}) => ({
  description: "Shop",
  amount: 12.5,
  date: "2026-10-31",
  categoryId,
  ...overrides,
});

const transactionsOf = (userId: string) =>
  prisma.transaction.findMany({ where: { userId }, orderBy: { description: "asc" } });

beforeEach(async () => {
  alice = await createUser("alice");
  bob = await createUser("bob");
  food = await category(alice.id, "Groceries", "EXPENSE");
  fun = await category(alice.id, "Fun", "EXPENSE");
  salary = await category(alice.id, "Salary", "INCOME");
  bobFood = await category(bob.id, "Food", "EXPENSE");
  await signInAs(alice);
});

afterEach(deleteTestUsers);
afterAll(() => prisma.$disconnect());

describe("createTransactions", () => {
  it("adds every row as an expense in ILS for the signed-in user, and says how many", async () => {
    const count = await createTransactions([
      row(food, { description: "Shop", amount: 12.5, date: "2026-10-31" }),
      row(fun, { description: "Cinema", amount: 80.2, date: "2026-11-01" }),
    ]);

    expect(count).toBe(2);
    const [cinema, shop] = await transactionsOf(alice.id);
    expect(shop).toMatchObject({
      userId: alice.id,
      categoryId: food,
      description: "Shop",
      type: "EXPENSE",
      currency: "ILS",
      note: null,
    });
    expect(shop.amount.toString()).toBe("12.5");
    expect(shop.date.toISOString()).toBe("2026-10-31T00:00:00.000Z");
    expect(cinema).toMatchObject({ categoryId: fun, description: "Cinema" });
    expect(cinema.amount.toString()).toBe("80.2");
    expect(cinema.date.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(await transactionsOf(bob.id)).toEqual([]);
  });

  it("keeps cents exact", async () => {
    await createTransactions([row(food, { amount: 0.1 }), row(food, { description: "B", amount: 0.2 })]);

    const amounts = (await transactionsOf(alice.id)).map((t) => t.amount.toString()).sort();
    expect(amounts).toEqual(["0.1", "0.2"]);
  });

  it("adds identical rows as separate transactions: buying the same thing twice in a day is real", async () => {
    await createTransactions([row(food), row(food), row(food)]);

    expect(await prisma.transaction.count({ where: { userId: alice.id } })).toBe(3);
  });

  it("adds to what is already there instead of replacing it", async () => {
    await createTransactions([row(food, { description: "First" })]);
    await createTransactions([row(food, { description: "Second" })]);

    expect((await transactionsOf(alice.id)).map((t) => t.description)).toEqual(["First", "Second"]);
  });

  it("adds a full import of 500 rows", async () => {
    const rows = Array.from({ length: 500 }, (_, i) => row(i % 2 === 0 ? food : fun, { description: `Row ${i}` }));

    expect(await createTransactions(rows)).toBe(500);
    expect(await prisma.transaction.count({ where: { userId: alice.id } })).toBe(500);
  });

  it("shows up in the transaction list, and in the month's spending and budget", async () => {
    await createTransactions([
      row(food, { amount: 100, date: "2026-10-04" }),
      row(fun, { amount: 50.5, date: "2026-10-09" }),
    ]);

    expect(await getTransactions()).toHaveLength(2);
    const overview = await getBudgetOverview({ month: "2026-10", now: new Date("2026-10-29T10:00:00Z") });
    expect(overview.totalSpent).toBe(150.5);
    expect(overview.rows.find((r) => r.categoryId === food)?.spent).toBe(100);
  });

  describe("all of it or none of it", () => {
    it.each([
      ["another user's category", () => bobFood],
      ["an income category", () => salary],
      ["a category that doesn't exist", () => "missing"],
    ])("refuses %s, and adds none of the rows", async (_name, bad) => {
      await expect(createTransactions([row(food), row(bad(), { description: "Bad" }), row(fun)])).rejects.toMatchObject({
        ...appError("INVALID_REFERENCE"),
        message: expect.stringContaining("expense categories"),
      });

      expect(await prisma.transaction.count()).toBe(0);
    });

    it("refuses a list where every row's category is one of the user's, except the last", async () => {
      const rows = [...Array.from({ length: 50 }, () => row(food)), row(bobFood)];

      await expect(createTransactions(rows)).rejects.toMatchObject(appError("INVALID_REFERENCE"));

      expect(await prisma.transaction.count()).toBe(0);
    });
  });

  it("can't file expenses under another user's category", async () => {
    await signInAs(bob);

    await expect(createTransactions([row(food)])).rejects.toMatchObject(appError("INVALID_REFERENCE"));

    expect(await prisma.transaction.count()).toBe(0);
  });

  it("sends signed-out callers to /login", async () => {
    signOut();

    await expect(createTransactions([row(food)])).rejects.toMatchObject({
      digest: expect.stringContaining("/login"),
    });
    expect(await prisma.transaction.count()).toBe(0);
  });
});
