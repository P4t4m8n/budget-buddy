import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);

import { createCategory } from "@/lib/data/categories";
import { CategoryMismatchError, NotFoundError } from "@/lib/data/errors";
import {
  createTransaction,
  deleteTransaction,
  getTransactions,
  updateTransaction,
} from "@/lib/data/transactions";
import { prisma } from "@/lib/prisma";
import type { TransactionInput } from "@/lib/validation/transaction";
import { createUser, deleteTestUsers, signInAs, signOut } from "./support";

let alice: { id: string };
let bob: { id: string };
let aliceFood: { id: string };
let aliceSalary: { id: string };

const expense = (overrides: Partial<TransactionInput> = {}): TransactionInput => ({
  description: "Supermarket",
  amount: 123.45,
  currency: "ILS",
  type: "EXPENSE",
  categoryId: aliceFood.id,
  date: "2026-10-27",
  note: null,
  ...overrides,
});

beforeEach(async () => {
  alice = await createUser("alice");
  bob = await createUser("bob");
  await signInAs(alice);
  aliceFood = await createCategory({ name: "Groceries", type: "EXPENSE", color: "#f59e0b" });
  aliceSalary = await createCategory({ name: "Salary", type: "INCOME", color: "#10b981" });
});

afterEach(deleteTestUsers);
afterAll(() => prisma.$disconnect());

describe("createTransaction", () => {
  it("returns the transaction in the shape the UI uses", async () => {
    const created = await createTransaction(expense({ note: "weekly shop" }));

    expect(created).toEqual({
      id: expect.any(String),
      categoryId: aliceFood.id,
      description: "Supermarket",
      amount: 123.45,
      currency: "ILS",
      type: "EXPENSE",
      date: "2026-10-27",
      note: "weekly shop",
    });
    expect(typeof created.amount).toBe("number");
  });

  it("stores the exact amount and the calendar date, owned by the signed-in user", async () => {
    const { id } = await createTransaction(expense({ amount: 1234567.89, date: "2026-02-28" }));

    const row = await prisma.transaction.findUniqueOrThrow({ where: { id } });
    expect(row.userId).toBe(alice.id);
    expect(row.amount.toString()).toBe("1234567.89");
    expect(row.date.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("handles income too", async () => {
    const created = await createTransaction(
      expense({ type: "INCOME", categoryId: aliceSalary.id, amount: 7200 }),
    );

    expect(created).toMatchObject({ type: "INCOME", amount: 7200 });
  });

  it("refuses another user's category and saves nothing", async () => {
    await signInAs(bob);
    const bobFood = await createCategory({ name: "Groceries", type: "EXPENSE", color: "#f59e0b" });
    await signInAs(alice);

    await expect(createTransaction(expense({ categoryId: bobFood.id }))).rejects.toBeInstanceOf(
      CategoryMismatchError,
    );
    expect(await prisma.transaction.count({ where: { userId: alice.id } })).toBe(0);
  });

  it("refuses a category that doesn't exist", async () => {
    await expect(createTransaction(expense({ categoryId: "nope" }))).rejects.toBeInstanceOf(
      CategoryMismatchError,
    );
  });

  it("refuses a category of the other type", async () => {
    await expect(
      createTransaction(expense({ type: "EXPENSE", categoryId: aliceSalary.id })),
    ).rejects.toBeInstanceOf(CategoryMismatchError);
    await expect(
      createTransaction(expense({ type: "INCOME", categoryId: aliceFood.id })),
    ).rejects.toBeInstanceOf(CategoryMismatchError);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it("sends signed-out visitors to /login", async () => {
    signOut();

    await expect(createTransaction(expense())).rejects.toMatchObject({
      digest: expect.stringContaining("/login"),
    });
  });
});

describe("getTransactions", () => {
  it("is empty for a new user", async () => {
    expect(await getTransactions()).toEqual([]);
  });

  it("lists newest first, and newest-created first within a day", async () => {
    await createTransaction(expense({ description: "old", date: "2026-10-01" }));
    await createTransaction(expense({ description: "new", date: "2026-10-27" }));
    await createTransaction(expense({ description: "same day, first", date: "2026-10-15" }));
    await createTransaction(expense({ description: "same day, second", date: "2026-10-15" }));

    expect((await getTransactions()).map((t) => t.description)).toEqual([
      "new",
      "same day, second",
      "same day, first",
      "old",
    ]);
  });

  it("never includes other users' transactions", async () => {
    await createTransaction(expense({ description: "alice's" }));
    await signInAs(bob);
    const bobFood = await createCategory({ name: "Food", type: "EXPENSE", color: "#f59e0b" });
    await createTransaction(expense({ description: "bob's", categoryId: bobFood.id }));

    expect((await getTransactions()).map((t) => t.description)).toEqual(["bob's"]);
    await signInAs(alice);
    expect((await getTransactions()).map((t) => t.description)).toEqual(["alice's"]);
  });

  it("returns amounts as numbers and dates as plain strings", async () => {
    await createTransaction(expense());

    const [transaction] = await getTransactions();
    expect(typeof transaction.amount).toBe("number");
    expect(transaction.date).toBe("2026-10-27");
    expect(JSON.parse(JSON.stringify(transaction))).toEqual(transaction);
  });

  it("sends signed-out visitors to /login", async () => {
    signOut();

    await expect(getTransactions()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });
});

describe("updateTransaction", () => {
  it("changes every editable field", async () => {
    const { id } = await createTransaction(expense());

    const updated = await updateTransaction(
      id,
      expense({
        description: "Salary",
        amount: 7200,
        type: "INCOME",
        categoryId: aliceSalary.id,
        date: "2026-10-01",
        note: "october",
      }),
    );

    expect(updated).toEqual({
      id,
      description: "Salary",
      amount: 7200,
      currency: "ILS",
      type: "INCOME",
      categoryId: aliceSalary.id,
      date: "2026-10-01",
      note: "october",
    });
    expect(await prisma.transaction.count({ where: { userId: alice.id } })).toBe(1);
  });

  it("can clear the note", async () => {
    const { id } = await createTransaction(expense({ note: "remove me" }));

    expect((await updateTransaction(id, expense({ note: null }))).note).toBeNull();
  });

  it("can't edit another user's transaction", async () => {
    const { id } = await createTransaction(expense());
    await signInAs(bob);
    const bobFood = await createCategory({ name: "Food", type: "EXPENSE", color: "#f59e0b" });

    await expect(
      updateTransaction(id, expense({ description: "Hacked", categoryId: bobFood.id })),
    ).rejects.toBeInstanceOf(NotFoundError);

    const row = await prisma.transaction.findUniqueOrThrow({ where: { id } });
    expect(row.description).toBe("Supermarket");
    expect(row.userId).toBe(alice.id);
  });

  it("refuses a mismatched category and leaves the transaction unchanged", async () => {
    const { id } = await createTransaction(expense());

    await expect(
      updateTransaction(id, expense({ description: "Changed", type: "INCOME", categoryId: aliceFood.id })),
    ).rejects.toBeInstanceOf(CategoryMismatchError);

    const row = await prisma.transaction.findUniqueOrThrow({ where: { id } });
    expect(row.description).toBe("Supermarket");
    expect(row.type).toBe("EXPENSE");
  });

  it("reports an unknown id", async () => {
    await expect(updateTransaction("does-not-exist", expense())).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("deleteTransaction", () => {
  it("deletes one's own transaction", async () => {
    const { id } = await createTransaction(expense());

    await deleteTransaction(id);

    expect(await prisma.transaction.count({ where: { id } })).toBe(0);
  });

  it("can't delete another user's transaction", async () => {
    const { id } = await createTransaction(expense());
    await signInAs(bob);

    await expect(deleteTransaction(id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await prisma.transaction.count({ where: { id } })).toBe(1);
  });

  it("reports an unknown id", async () => {
    await expect(deleteTransaction("does-not-exist")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("account removal", () => {
  it("removes a user's categories and transactions together with the user", async () => {
    await createTransaction(expense());
    await createTransaction(expense({ type: "INCOME", categoryId: aliceSalary.id }));

    await prisma.user.delete({ where: { id: alice.id } });

    expect(await prisma.transaction.count({ where: { userId: alice.id } })).toBe(0);
    expect(await prisma.category.count({ where: { userId: alice.id } })).toBe(0);
  });
});
