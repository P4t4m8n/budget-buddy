import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import {
  createWishlistItemAction,
  deleteWishlistItemAction,
  purchaseWishlistItemAction,
  updateWishlistItemAction,
} from "@/actions/wishlist";
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

const itemForm = (overrides: Record<string, string> = {}) =>
  form({
    name: "Standing desk",
    price: "620.50",
    priority: "HIGH",
    status: "WANTED",
    url: "https://example.com/desk",
    notes: "",
    ...overrides,
  });

const purchaseForm = (overrides: Record<string, string> = {}) =>
  form({ categoryId: aliceFood, date: "2026-10-29", ...overrides });

const itemsOf = (userId: string) => prisma.wishlistItem.findMany({ where: { userId } });
const transactionsOf = (userId: string) => prisma.transaction.findMany({ where: { userId } });

const category = async (userId: string, name: string, type: "INCOME" | "EXPENSE") =>
  (await prisma.category.create({ data: { userId, name, type, color: "#f59e0b" } })).id;

const seed = async (userId: string, name: string, status: "WANTED" | "PURCHASED" = "WANTED") =>
  (await prisma.wishlistItem.create({ data: { userId, name, price: 100, priority: "LOW", status } })).id;

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
describe("wishlist Server Actions against the database", () => {
  it("creates an item for the signed-in user with the exact price", async () => {
    expect(await createWishlistItemAction(idle, itemForm())).toEqual({ status: "success" });

    const [row] = await itemsOf(alice.id);
    expect(row).toMatchObject({
      name: "Standing desk",
      priority: "HIGH",
      status: "WANTED",
      currency: "ILS",
      url: "https://example.com/desk",
      notes: null,
    });
    expect(row.price.toString()).toBe("620.5");
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/wishlist");
  });

  it("ignores a userId, id or currency in the form data", async () => {
    await createWishlistItemAction(idle, itemForm({ userId: bob.id, id: "chosen-id", currency: "USD" }));

    expect(await itemsOf(bob.id)).toEqual([]);
    const [row] = await itemsOf(alice.id);
    expect(row.id).not.toBe("chosen-id");
    expect(row.currency).toBe("ILS");
  });

  it("can't create an already purchased item without recording the expense", async () => {
    const result = await createWishlistItemAction(idle, itemForm({ status: "PURCHASED" }));

    expect(result.status).toBe("error");
    expect(await prisma.wishlistItem.count()).toBe(0);
  });

  it("can't smuggle PURCHASED in through an update either", async () => {
    const id = await seed(alice.id, "Desk");

    const result = await updateWishlistItemAction(id, idle, itemForm({ status: "PURCHASED" }));

    expect(result.status).toBe("error");
    expect(await prisma.wishlistItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "WANTED" });
  });

  it("refuses a javascript: link and saves nothing", async () => {
    const result = await createWishlistItemAction(idle, itemForm({ url: "javascript:alert(1)" }));

    expect(result.fieldErrors?.url).toContain("http://");
    expect(await prisma.wishlistItem.count()).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("updates one's own item", async () => {
    const id = await seed(alice.id, "Desk");

    expect(await updateWishlistItemAction(id, idle, itemForm({ name: "Standing desk", status: "SAVING" }))).toEqual({
      status: "success",
    });

    expect(await prisma.wishlistItem.findUniqueOrThrow({ where: { id } })).toMatchObject({
      name: "Standing desk",
      status: "SAVING",
    });
  });

  it("can't update another user's item, even with its id", async () => {
    const id = await seed(bob.id, "Bob's");

    const result = await updateWishlistItemAction(id, idle, itemForm({ name: "Hijacked" }));

    expect(result).toMatchObject({ status: "error", errorCode: "NOT_FOUND" });
    expect(await prisma.wishlistItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ name: "Bob's" });
  });

  it("purchases an item: marks it, records the expense, and refreshes every page that shows it", async () => {
    const id = await seed(alice.id, "Desk");

    expect(await purchaseWishlistItemAction(id, idle, purchaseForm())).toEqual({ status: "success" });

    expect(await prisma.wishlistItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "PURCHASED" });
    const [transaction] = await transactionsOf(alice.id);
    expect(transaction).toMatchObject({ description: "Desk", type: "EXPENSE", categoryId: aliceFood });
    expect(transaction.amount.toString()).toBe("100");
    expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path).sort()).toEqual([
      "/budget",
      "/dashboard",
      "/transactions",
      "/wishlist",
    ]);
  });

  it("ignores an amount, description or type in the purchase form: they come from the item", async () => {
    const id = await seed(alice.id, "Desk");

    await purchaseWishlistItemAction(
      id,
      idle,
      purchaseForm({ amount: "1", description: "Free money", type: "INCOME", userId: bob.id }),
    );

    expect(await transactionsOf(bob.id)).toEqual([]);
    const [transaction] = await transactionsOf(alice.id);
    expect(transaction).toMatchObject({ description: "Desk", type: "EXPENSE" });
    expect(transaction.amount.toString()).toBe("100");
  });

  it.each([
    ["another user's category", () => bobFood],
    ["an income category", () => aliceSalary],
  ])("refuses to purchase into %s", async (_name, pick) => {
    const id = await seed(alice.id, "Desk");

    const result = await purchaseWishlistItemAction(id, idle, purchaseForm({ categoryId: pick() }));

    expect(result).toMatchObject({ status: "error", errorCode: "INVALID_REFERENCE" });
    expect(result.fieldErrors?.categoryId).toContain("expense categories");
    expect(await prisma.wishlistItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "WANTED" });
    expect(await prisma.transaction.count()).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("says so when the item was already purchased, and records nothing more", async () => {
    const id = await seed(alice.id, "Desk");
    await purchaseWishlistItemAction(id, idle, purchaseForm());
    vi.mocked(revalidatePath).mockClear();

    const result = await purchaseWishlistItemAction(id, idle, purchaseForm());

    expect(result).toMatchObject({ status: "error", errorCode: "DUPLICATE", message: expect.stringContaining("already") });
    expect(await transactionsOf(alice.id)).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("deletes one's own item", async () => {
    const id = await seed(alice.id, "Desk");

    expect(await deleteWishlistItemAction(id)).toEqual({ ok: true });
    expect(await itemsOf(alice.id)).toEqual([]);
  });

  it("can't delete another user's item, even with its id", async () => {
    const id = await seed(bob.id, "Bob's");

    expect(await deleteWishlistItemAction(id)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await itemsOf(bob.id)).toHaveLength(1);
  });

  it("sends signed-out callers to /login instead of returning data", async () => {
    const id = await seed(alice.id, "Desk");
    signOut();
    const toLogin = { digest: expect.stringContaining("/login") };

    await expect(createWishlistItemAction(idle, itemForm())).rejects.toMatchObject(toLogin);
    await expect(updateWishlistItemAction(id, idle, itemForm())).rejects.toMatchObject(toLogin);
    await expect(purchaseWishlistItemAction(id, idle, purchaseForm())).rejects.toMatchObject(toLogin);
    await expect(deleteWishlistItemAction(id)).rejects.toMatchObject(toLogin);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await prisma.wishlistItem.count()).toBe(1);
    expect(await prisma.transaction.count()).toBe(0);
  });
});
