import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import { deleteBudgetAction, setBudgetAction } from "@/actions/budgets";
import { prisma } from "@/lib/prisma";
import { createUser, deleteTestUsers, signInAs, signOut } from "./support";

const idle = { status: "idle" } as const;

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
};

let alice: { id: string };
let bob: { id: string };
let aliceFood: string;
let aliceSalary: string;
let bobFood: string;

const budgetForm = (overrides: Record<string, string> = {}) =>
  form({ categoryId: aliceFood, month: "2026-10", limit: "1200.50", ...overrides });

const budgetsOf = (userId: string) => prisma.budget.findMany({ where: { userId } });

const category = async (userId: string, name: string, type: "INCOME" | "EXPENSE") =>
  (await prisma.category.create({ data: { userId, name, type, color: "#f59e0b" } })).id;

beforeEach(async () => {
  vi.mocked(revalidatePath).mockClear();
  alice = await createUser("alice");
  bob = await createUser("bob");
  aliceFood = await category(alice.id, "Groceries", "EXPENSE");
  aliceSalary = await category(alice.id, "Salary", "INCOME");
  bobFood = await category(bob.id, "Food", "EXPENSE");
  await signInAs(alice);
});

afterEach(deleteTestUsers);
afterAll(() => prisma.$disconnect());

// These call the Server Actions the way a browser would: anyone can POST to them,
// so each one has to be safe on its own
describe("budget Server Actions against the database", () => {
  it("sets a budget for the signed-in user with the exact limit", async () => {
    expect(await setBudgetAction(idle, budgetForm())).toEqual({ status: "success" });

    const [row] = await budgetsOf(alice.id);
    expect(row).toMatchObject({ categoryId: aliceFood, currency: "ILS" });
    expect(row.limit.toString()).toBe("1200.5");
    expect(row.month.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(revalidatePath).toHaveBeenCalledWith("/budget");
  });

  it("changes the limit when setting it again", async () => {
    await setBudgetAction(idle, budgetForm({ limit: "1000" }));
    await setBudgetAction(idle, budgetForm({ limit: "1500" }));

    const rows = await budgetsOf(alice.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].limit.toString()).toBe("1500");
  });

  it("ignores a userId, id or currency in the form data", async () => {
    await setBudgetAction(idle, budgetForm({ userId: bob.id, id: "chosen-id", currency: "USD" }));

    expect(await budgetsOf(bob.id)).toEqual([]);
    const [row] = await budgetsOf(alice.id);
    expect(row.id).not.toBe("chosen-id");
    expect(row.currency).toBe("ILS");
  });

  it("saves nothing when validation fails", async () => {
    const result = await setBudgetAction(idle, budgetForm({ limit: "0", month: "2026-13" }));

    expect(result.status).toBe("error");
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["limit", "month"]);
    expect(await budgetsOf(alice.id)).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses another user's category and an income category, and saves nothing", async () => {
    const others = await setBudgetAction(idle, budgetForm({ categoryId: bobFood }));
    const income = await setBudgetAction(idle, budgetForm({ categoryId: aliceSalary }));

    expect(others.fieldErrors?.categoryId).toContain("expense categories");
    expect(income.fieldErrors?.categoryId).toContain("expense categories");
    expect(await prisma.budget.count()).toBe(0);
  });

  it("deletes one's own budget", async () => {
    await setBudgetAction(idle, budgetForm());
    const [{ id }] = await budgetsOf(alice.id);

    expect(await deleteBudgetAction(id)).toEqual({ ok: true });
    expect(await budgetsOf(alice.id)).toEqual([]);
  });

  it("can't delete another user's budget, even with its id", async () => {
    await setBudgetAction(idle, budgetForm());
    const [{ id }] = await budgetsOf(alice.id);
    await signInAs(bob);

    expect(await deleteBudgetAction(id)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await budgetsOf(alice.id)).toHaveLength(1);
  });

  it("sends signed-out callers to /login instead of returning data", async () => {
    signOut();
    const toLogin = { digest: expect.stringContaining("/login") };

    await expect(setBudgetAction(idle, budgetForm())).rejects.toMatchObject(toLogin);
    await expect(deleteBudgetAction("any")).rejects.toMatchObject(toLogin);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await prisma.budget.count()).toBe(0);
  });
});
