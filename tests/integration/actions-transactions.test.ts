import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import {
  createTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
} from "@/actions/transactions";
import { createCategory } from "@/lib/data/categories";
import { prisma } from "@/lib/prisma";
import { createUser, deleteTestUsers, signInAs, signOut } from "./support";

const idle = { status: "idle" } as const;

const notFound = {
  ok: false,
  error: { code: "NOT_FOUND", message: expect.stringContaining("no longer exists") },
};

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
};

let alice: { id: string };
let bob: { id: string };
let aliceFood: { id: string };
let aliceSalary: { id: string };
let bobFood: { id: string };

const expense = (overrides: Record<string, string> = {}) =>
  form({
    description: "Supermarket",
    amount: "123.45",
    type: "EXPENSE",
    categoryId: aliceFood.id,
    date: "2026-10-27",
    note: "",
    ...overrides,
  });

const rowsOf = (userId: string) =>
  prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });

beforeEach(async () => {
  vi.mocked(revalidatePath).mockClear();
  alice = await createUser("alice");
  bob = await createUser("bob");
  await signInAs(bob);
  bobFood = await createCategory({ name: "Food", type: "EXPENSE", color: "#f59e0b" });
  await signInAs(alice);
  aliceFood = await createCategory({ name: "Groceries", type: "EXPENSE", color: "#f59e0b" });
  aliceSalary = await createCategory({ name: "Salary", type: "INCOME", color: "#10b981" });
});

afterEach(deleteTestUsers);
afterAll(() => prisma.$disconnect());

// These call the Server Actions the way a browser would: anyone can POST to them,
// so each one has to be safe on its own
describe("transaction Server Actions against the database", () => {
  it("creates a transaction for the signed-in user with the exact amount and date", async () => {
    expect(await createTransactionAction(idle, expense({ amount: "1234567.89" }))).toEqual({
      status: "success",
    });

    const [row] = await rowsOf(alice.id);
    expect(row).toMatchObject({ description: "Supermarket", type: "EXPENSE", currency: "ILS" });
    expect(row.amount.toString()).toBe("1234567.89");
    expect(row.date.toISOString()).toBe("2026-10-27T00:00:00.000Z");
    expect(revalidatePath).toHaveBeenCalledWith("/transactions");
  });

  it("ignores a userId, id or currency in the form data", async () => {
    await createTransactionAction(
      idle,
      expense({ userId: bob.id, id: "chosen-id", currency: "USD" }),
    );

    expect(await rowsOf(bob.id)).toEqual([]);
    const [row] = await rowsOf(alice.id);
    expect(row.id).not.toBe("chosen-id");
    expect(row.currency).toBe("ILS");
  });

  it("saves nothing when validation fails", async () => {
    const result = await createTransactionAction(idle, expense({ amount: "0" }));

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.amount).toBeDefined();
    expect(await rowsOf(alice.id)).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses another user's category and saves nothing", async () => {
    const result = await createTransactionAction(idle, expense({ categoryId: bobFood.id }));

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.categoryId).toContain("matches the transaction type");
    expect(await rowsOf(alice.id)).toEqual([]);
    expect(await rowsOf(bob.id)).toEqual([]);
  });

  it("refuses a category of the other type", async () => {
    const result = await createTransactionAction(idle, expense({ type: "INCOME" }));

    expect(result.fieldErrors?.categoryId).toBeDefined();
    expect(await rowsOf(alice.id)).toEqual([]);
  });

  it("updates every field, including switching to income", async () => {
    await createTransactionAction(idle, expense());
    const [{ id }] = await rowsOf(alice.id);

    const result = await updateTransactionAction(
      id,
      idle,
      expense({
        description: "Salary",
        amount: "7200",
        type: "INCOME",
        categoryId: aliceSalary.id,
        date: "2026-10-01",
        note: "october",
      }),
    );

    expect(result).toEqual({ status: "success" });
    const [row] = await rowsOf(alice.id);
    expect(row).toMatchObject({ id, description: "Salary", type: "INCOME", note: "october" });
    expect(row.amount.toString()).toBe("7200");
  });

  it("can't update another user's transaction, even with its id", async () => {
    await createTransactionAction(idle, expense());
    const [{ id }] = await rowsOf(alice.id);
    await signInAs(bob);

    const result = await updateTransactionAction(
      id,
      idle,
      expense({ description: "Hacked", categoryId: bobFood.id }),
    );

    expect(result.message).toContain("no longer exists");
    const [row] = await rowsOf(alice.id);
    expect(row.description).toBe("Supermarket");
  });

  it("can't move one's own transaction into another user's category", async () => {
    await createTransactionAction(idle, expense());
    const [{ id }] = await rowsOf(alice.id);

    const result = await updateTransactionAction(id, idle, expense({ categoryId: bobFood.id }));

    expect(result.fieldErrors?.categoryId).toBeDefined();
    expect((await rowsOf(alice.id))[0].categoryId).toBe(aliceFood.id);
  });

  it("deletes one's own transaction", async () => {
    await createTransactionAction(idle, expense());
    const [{ id }] = await rowsOf(alice.id);

    expect(await deleteTransactionAction(id)).toEqual({ ok: true });
    expect(await rowsOf(alice.id)).toEqual([]);
  });

  it("can't delete another user's transaction, even with its id", async () => {
    await createTransactionAction(idle, expense());
    const [{ id }] = await rowsOf(alice.id);
    await signInAs(bob);

    expect(await deleteTransactionAction(id)).toEqual(notFound);
    expect(await rowsOf(alice.id)).toHaveLength(1);
  });

  it("reports a transaction that is already gone", async () => {
    expect(await deleteTransactionAction("does-not-exist")).toEqual(notFound);
  });

  it("sends signed-out callers to /login instead of returning data", async () => {
    signOut();
    const toLogin = { digest: expect.stringContaining("/login") };

    await expect(createTransactionAction(idle, expense())).rejects.toMatchObject(toLogin);
    await expect(updateTransactionAction("any", idle, expense())).rejects.toMatchObject(toLogin);
    await expect(deleteTransactionAction("any")).rejects.toMatchObject(toLogin);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await prisma.transaction.count({ where: { user: { email: { endsWith: "@integration.test" } } } })).toBe(0);
  });
});
