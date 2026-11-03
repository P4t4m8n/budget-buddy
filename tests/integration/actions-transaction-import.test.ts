import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import { importTransactionsAction } from "@/actions/transactions";
import { prisma } from "@/lib/prisma";
import { createUser, deleteTestUsers, signInAs, signOut } from "./support";

let alice: { id: string };
let bob: { id: string };
let food: string;
let salary: string;
let bobFood: string;

const category = async (userId: string, name: string, type: "INCOME" | "EXPENSE") =>
  (await prisma.category.create({ data: { userId, name, type, color: "#f59e0b" } })).id;

const row = (categoryId: string, overrides: Record<string, unknown> = {}) => ({
  description: "Shop",
  amount: 12.5,
  date: "2026-10-31",
  categoryId,
  ...overrides,
});

const transactionsOf = (userId: string) => prisma.transaction.findMany({ where: { userId } });
const refreshedPaths = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path).sort();

beforeEach(async () => {
  vi.mocked(revalidatePath).mockClear();
  alice = await createUser("alice");
  bob = await createUser("bob");
  food = await category(alice.id, "Groceries", "EXPENSE");
  salary = await category(alice.id, "Salary", "INCOME");
  bobFood = await category(bob.id, "Food", "EXPENSE");
  await signInAs(alice);
});

afterEach(deleteTestUsers);
afterAll(() => prisma.$disconnect());

// These call the Server Action the way a browser would: anyone can POST to it,
// so it has to be safe on its own
describe("importTransactionsAction against the database", () => {
  it("adds the rows as expenses with exact amounts, and refreshes the pages that show them", async () => {
    const result = await importTransactionsAction([
      row(food, { amount: "12.50" }),
      row(food, { description: "Cafe", amount: 3.2, date: "2026-11-01" }),
    ]);

    expect(result).toEqual({ ok: true, count: 2 });
    const saved = await transactionsOf(alice.id);
    expect(saved).toHaveLength(2);
    expect(saved.every((t) => t.type === "EXPENSE" && t.currency === "ILS" && t.userId === alice.id)).toBe(true);
    expect(saved.map((t) => t.amount.toString()).sort()).toEqual(["12.5", "3.2"]);
    expect(refreshedPaths()).toEqual(["/budget", "/dashboard", "/transactions"]);
  });

  it("ignores a userId, type, currency or id in a row", async () => {
    await importTransactionsAction([
      row(food, { userId: bob.id, type: "INCOME", currency: "USD", id: "chosen-id", note: "x" }),
    ]);

    expect(await transactionsOf(bob.id)).toEqual([]);
    const [saved] = await transactionsOf(alice.id);
    expect(saved).toMatchObject({ type: "EXPENSE", currency: "ILS", note: null });
    expect(saved.id).not.toBe("chosen-id");
  });

  it("saves nothing when any row is invalid, and says which", async () => {
    const result = await importTransactionsAction([row(food), row(food, { date: "2026-02-30" }), row(food)]);

    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_INPUT", message: "Row 2: Enter a valid date" },
    });
    expect(await transactionsOf(alice.id)).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["another user's category", () => bobFood],
    ["an income category", () => salary],
  ])("refuses %s, saves nothing, and refreshes nothing", async (_name, bad) => {
    const result = await importTransactionsAction([row(food), row(bad())]);

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_REFERENCE" } });
    expect(await prisma.transaction.count()).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses more than 500 rows", async () => {
    const result = await importTransactionsAction(Array.from({ length: 501 }, () => row(food)));

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
    expect(await prisma.transaction.count()).toBe(0);
  });

  it("sends signed-out callers to /login instead of saving anything", async () => {
    signOut();

    await expect(importTransactionsAction([row(food)])).rejects.toMatchObject({
      digest: expect.stringContaining("/login"),
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await prisma.transaction.count()).toBe(0);
  });
});
