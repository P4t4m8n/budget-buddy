import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);

import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from "@/lib/data/categories";
import { appError } from "../setup/app-error";
import { prisma } from "@/lib/prisma";
import { createUser, deleteTestUsers, signInAs, signOut } from "./support";

const food = { name: "Groceries", type: "EXPENSE", color: "#f59e0b" } as const;

let alice: { id: string };
let bob: { id: string };

beforeEach(async () => {
  alice = await createUser("alice");
  bob = await createUser("bob");
  await signInAs(alice);
});

afterEach(deleteTestUsers);
afterAll(() => prisma.$disconnect());

describe("getCategories", () => {
  it("is empty for a new user", async () => {
    expect(await getCategories()).toEqual([]);
  });

  it("returns income before expenses, each sorted by name", async () => {
    await createCategory({ name: "Rent", type: "EXPENSE", color: "#6366f1" });
    await createCategory({ name: "Salary", type: "INCOME", color: "#10b981" });
    await createCategory({ name: "Food", type: "EXPENSE", color: "#f59e0b" });
    await createCategory({ name: "Freelance", type: "INCOME", color: "#22c55e" });

    expect((await getCategories()).map((c) => c.name)).toEqual(["Freelance", "Salary", "Food", "Rent"]);
  });

  it("returns only the fields the UI needs", async () => {
    await createCategory(food);

    expect(Object.keys((await getCategories())[0]).sort()).toEqual(["color", "id", "name", "type"]);
  });

  it("only shows the signed-in user's categories", async () => {
    await createCategory(food);
    await signInAs(bob);
    await createCategory({ name: "Bob's own", type: "INCOME", color: "#10b981" });

    expect((await getCategories()).map((c) => c.name)).toEqual(["Bob's own"]);
    await signInAs(alice);
    expect((await getCategories()).map((c) => c.name)).toEqual(["Groceries"]);
  });

  it("sends signed-out visitors to /login", async () => {
    signOut();

    await expect(getCategories()).rejects.toMatchObject({
      digest: expect.stringContaining("/login"),
    });
  });
});

describe("createCategory", () => {
  it("creates a category owned by the signed-in user", async () => {
    const created = await createCategory(food);

    expect(created).toEqual({ id: expect.any(String), ...food });
    const row = await prisma.category.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.userId).toBe(alice.id);
  });

  it("rejects a duplicate name and type", async () => {
    await createCategory(food);

    await expect(createCategory({ ...food, color: "#000000" })).rejects.toMatchObject({
      ...appError("DUPLICATE"),
      field: "name",
    });
  });

  it("allows the same name with another type", async () => {
    await createCategory({ name: "Other", type: "EXPENSE", color: "#f59e0b" });

    await expect(createCategory({ name: "Other", type: "INCOME", color: "#10b981" })).resolves.toBeDefined();
  });

  it("allows another user to use the same name", async () => {
    await createCategory(food);
    await signInAs(bob);

    await expect(createCategory(food)).resolves.toBeDefined();
  });

  it("sends signed-out visitors to /login", async () => {
    signOut();

    await expect(createCategory(food)).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
    expect(await prisma.category.count({ where: { name: food.name, user: { email: { endsWith: "@integration.test" } } } })).toBe(0);
  });
});

describe("updateCategory", () => {
  it("renames and recolors a category", async () => {
    const { id } = await createCategory(food);

    const updated = await updateCategory(id, { name: "Food", color: "#10b981" });

    expect(updated).toEqual({ id, name: "Food", type: "EXPENSE", color: "#10b981" });
  });

  it("never changes the type", async () => {
    const { id } = await createCategory(food);

    // The schema strips `type`; even if it slipped through, only name and color are written
    const updated = await updateCategory(id, { name: "Food", color: "#10b981", type: "INCOME" } as never);

    expect(updated.type).toBe("EXPENSE");
  });

  it("rejects a rename that collides with another category", async () => {
    await createCategory({ name: "Rent", type: "EXPENSE", color: "#6366f1" });
    const { id } = await createCategory(food);

    await expect(updateCategory(id, { name: "Rent", color: "#000000" })).rejects.toMatchObject(
      appError("DUPLICATE"),
    );
  });

  it("can't touch another user's category", async () => {
    const { id } = await createCategory(food);
    await signInAs(bob);

    await expect(updateCategory(id, { name: "Hacked", color: "#000000" })).rejects.toMatchObject(appError("NOT_FOUND"));

    const row = await prisma.category.findUniqueOrThrow({ where: { id } });
    expect(row.name).toBe("Groceries");
  });

  it("reports an unknown id", async () => {
    await expect(updateCategory("does-not-exist", { name: "X", color: "#000000" })).rejects.toMatchObject(
      appError("NOT_FOUND"),
    );
  });
});

describe("deleteCategory", () => {
  it("deletes an unused category", async () => {
    const { id } = await createCategory(food);

    await deleteCategory(id);

    expect(await prisma.category.count({ where: { id } })).toBe(0);
  });

  it("refuses while transactions use it, and keeps everything", async () => {
    const { id } = await createCategory(food);
    await prisma.transaction.create({
      data: {
        userId: alice.id,
        categoryId: id,
        description: "x",
        amount: 10,
        type: "EXPENSE",
        date: new Date("2026-10-01T00:00:00Z"),
      },
    });

    const error = await deleteCategory(id).catch((e: unknown) => e);

    expect(error).toMatchObject({ ...appError("IN_USE"), details: { transactions: 1, budgets: 0 } });
    expect(await prisma.category.count({ where: { id } })).toBe(1);
  });

  it("refuses while a budget uses it", async () => {
    const { id } = await createCategory(food);
    await prisma.budget.create({
      data: { userId: alice.id, categoryId: id, month: new Date("2026-10-01T00:00:00Z"), limit: 500 },
    });

    const error = await deleteCategory(id).catch((e: unknown) => e);

    expect(error).toMatchObject({ ...appError("IN_USE"), details: { transactions: 0, budgets: 1 } });
  });

  it("can't delete another user's category", async () => {
    const { id } = await createCategory(food);
    await signInAs(bob);

    await expect(deleteCategory(id)).rejects.toMatchObject(appError("NOT_FOUND"));
    expect(await prisma.category.count({ where: { id } })).toBe(1);
  });

  it("reports an unknown id", async () => {
    await expect(deleteCategory("does-not-exist")).rejects.toMatchObject(appError("NOT_FOUND"));
  });
});
