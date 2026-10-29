import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/actions/categories";
import { prisma } from "@/lib/prisma";
import { createUser, deleteTestUsers, signInAs, signOut } from "./support";

const idle = { status: "idle" } as const;

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
};

const groceries = { name: "Groceries", type: "EXPENSE", color: "#f59e0b" };

let alice: { id: string };
let bob: { id: string };

beforeEach(async () => {
  vi.mocked(revalidatePath).mockClear();
  alice = await createUser("alice");
  bob = await createUser("bob");
  await signInAs(alice);
});

afterEach(deleteTestUsers);
afterAll(() => prisma.$disconnect());

// These call the Server Actions the way a browser would: anyone can POST to them,
// so each one has to be safe on its own
describe("category Server Actions against the database", () => {
  it("creates a category for the signed-in user", async () => {
    expect(await createCategoryAction(idle, form(groceries))).toEqual({ status: "success" });

    const rows = await prisma.category.findMany({ where: { userId: alice.id } });
    expect(rows).toMatchObject([{ name: "Groceries", type: "EXPENSE", color: "#f59e0b" }]);
    expect(revalidatePath).toHaveBeenCalledWith("/categories");
  });

  it("reports a duplicate without creating a second row", async () => {
    await createCategoryAction(idle, form(groceries));

    const result = await createCategoryAction(idle, form(groceries));

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.name).toContain("already have");
    expect(await prisma.category.count({ where: { userId: alice.id } })).toBe(1);
  });

  it("ignores a userId in the form data", async () => {
    await createCategoryAction(idle, form({ ...groceries, userId: bob.id }));

    expect(await prisma.category.count({ where: { userId: bob.id } })).toBe(0);
    expect(await prisma.category.count({ where: { userId: alice.id } })).toBe(1);
  });

  it("updates name and color but never the type", async () => {
    await createCategoryAction(idle, form(groceries));
    const { id } = await prisma.category.findFirstOrThrow({ where: { userId: alice.id } });

    await updateCategoryAction(id, idle, form({ name: "Food", color: "#10b981", type: "INCOME" }));

    expect(await prisma.category.findUniqueOrThrow({ where: { id } })).toMatchObject({
      name: "Food",
      color: "#10b981",
      type: "EXPENSE",
    });
  });

  it("can't update another user's category, even with its id", async () => {
    await createCategoryAction(idle, form(groceries));
    const { id } = await prisma.category.findFirstOrThrow({ where: { userId: alice.id } });
    await signInAs(bob);

    const result = await updateCategoryAction(id, idle, form({ name: "Hacked", color: "#000000" }));

    expect(result.message).toContain("no longer exists");
    expect((await prisma.category.findUniqueOrThrow({ where: { id } })).name).toBe("Groceries");
  });

  it("can't delete another user's category, even with its id", async () => {
    await createCategoryAction(idle, form(groceries));
    const { id } = await prisma.category.findFirstOrThrow({ where: { userId: alice.id } });
    await signInAs(bob);

    expect(await deleteCategoryAction(id)).toEqual({ ok: false, reason: "not_found" });
    expect(await prisma.category.count({ where: { id } })).toBe(1);
  });

  it("deletes an unused category", async () => {
    await createCategoryAction(idle, form(groceries));
    const { id } = await prisma.category.findFirstOrThrow({ where: { userId: alice.id } });

    expect(await deleteCategoryAction(id)).toEqual({ ok: true });
    expect(await prisma.category.count({ where: { id } })).toBe(0);
  });

  it("refuses to delete a category with transactions and says how many", async () => {
    await createCategoryAction(idle, form(groceries));
    const { id } = await prisma.category.findFirstOrThrow({ where: { userId: alice.id } });
    await prisma.transaction.createMany({
      data: [1, 2].map((n) => ({
        userId: alice.id,
        categoryId: id,
        description: `t${n}`,
        amount: 10,
        type: "EXPENSE" as const,
        date: new Date("2026-10-01T00:00:00Z"),
      })),
    });

    expect(await deleteCategoryAction(id)).toEqual({
      ok: false,
      reason: "in_use",
      transactions: 2,
      budgets: 0,
    });
    expect(await prisma.category.count({ where: { id } })).toBe(1);
  });

  it("sends signed-out callers to /login instead of returning data", async () => {
    signOut();
    const toLogin = { digest: expect.stringContaining("/login") };

    await expect(createCategoryAction(idle, form(groceries))).rejects.toMatchObject(toLogin);
    await expect(updateCategoryAction("any", idle, form({ name: "X", color: "#000000" }))).rejects.toMatchObject(toLogin);
    await expect(deleteCategoryAction("any")).rejects.toMatchObject(toLogin);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
