import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);

import {
  createWishlistItem,
  deleteWishlistItem,
  getWishlist,
  purchaseWishlistItem,
  updateWishlistItem,
} from "@/lib/data/wishlist";
import { prisma } from "@/lib/prisma";
import { appError } from "../setup/app-error";
import { createUser, deleteTestUsers, signInAs, signOut } from "./support";

let alice: { id: string };
let bob: { id: string };
let groceries: string;
let salary: string;
let bobFood: string;

const category = async (userId: string, name: string, type: "INCOME" | "EXPENSE") =>
  (await prisma.category.create({ data: { userId, name, type, color: "#f59e0b" } })).id;

const input = (overrides: Partial<Parameters<typeof createWishlistItem>[0]> = {}) => ({
  name: "Standing desk",
  price: 620,
  currency: "ILS" as const,
  priority: "MEDIUM" as const,
  status: "WANTED" as const,
  url: null,
  notes: null,
  ...overrides,
});

type Seed = {
  userId?: string;
  name: string;
  price?: number | string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  status?: "WANTED" | "SAVING" | "PURCHASED";
  currency?: "ILS" | "USD";
};

const seed = async (...rows: Seed[]) => {
  const ids: string[] = [];
  for (const row of rows) {
    const item = await prisma.wishlistItem.create({
      data: {
        userId: row.userId ?? alice.id,
        name: row.name,
        price: row.price ?? 100,
        priority: row.priority ?? "MEDIUM",
        status: row.status ?? "WANTED",
        currency: row.currency ?? "ILS",
      },
    });
    ids.push(item.id);
  }
  return ids;
};

const itemsOf = (userId: string) => prisma.wishlistItem.findMany({ where: { userId } });
const transactionsOf = (userId: string) => prisma.transaction.findMany({ where: { userId } });

beforeEach(async () => {
  alice = await createUser("alice");
  bob = await createUser("bob");
  groceries = await category(alice.id, "Groceries", "EXPENSE");
  salary = await category(alice.id, "Salary", "INCOME");
  bobFood = await category(bob.id, "Food", "EXPENSE");
  await signInAs(alice);
});

afterEach(deleteTestUsers);
afterAll(() => prisma.$disconnect());

describe("getWishlist", () => {
  it("is empty for a new user", async () => {
    expect(await getWishlist()).toEqual({ open: [], purchased: [], openTotal: 0, purchasedTotal: 0 });
  });

  it("lists open items most wanted first, then by name, and keeps purchased ones apart", async () => {
    await seed(
      { name: "Espresso machine", priority: "LOW" },
      { name: "Monitor", priority: "MEDIUM", status: "SAVING" },
      { name: "Keyboard", priority: "MEDIUM" },
      { name: "Headphones", priority: "HIGH" },
      { name: "Desk", priority: "HIGH" },
      { name: "Shoes", status: "PURCHASED" },
      { name: "Backpack", status: "PURCHASED" },
    );

    const { open, purchased } = await getWishlist();

    expect(open.map((i) => i.name)).toEqual(["Desk", "Headphones", "Keyboard", "Monitor", "Espresso machine"]);
    expect(purchased.map((i) => i.name)).toEqual(["Backpack", "Shoes"]);
  });

  it("returns plain items: numbers for prices, and no user id", async () => {
    await seed({ name: "Desk", price: "620.50", priority: "HIGH" });

    const { open } = await getWishlist();

    expect(open).toEqual([
      {
        id: expect.any(String),
        name: "Desk",
        price: 620.5,
        currency: "ILS",
        priority: "HIGH",
        status: "WANTED",
        url: null,
        notes: null,
      },
    ]);
  });

  it("adds up prices exactly, to the cent", async () => {
    await seed(
      { name: "A", price: "0.10" },
      { name: "B", price: "0.20" },
      { name: "C", price: "1000.05", status: "SAVING" },
      { name: "D", price: "99.99", status: "PURCHASED" },
      { name: "E", price: "0.01", status: "PURCHASED" },
    );

    const { openTotal, purchasedTotal } = await getWishlist();

    expect(openTotal).toBe(1000.35);
    expect(purchasedTotal).toBe(100);
  });

  it("only adds up ILS prices", async () => {
    await seed({ name: "Desk", price: 600 }, { name: "Import", price: 50, currency: "USD" });

    const { open, openTotal } = await getWishlist();

    expect(open).toHaveLength(2);
    expect(openTotal).toBe(600);
  });

  it("only returns the signed-in user's items", async () => {
    await seed({ name: "Mine" }, { userId: bob.id, name: "Bob's" });

    expect((await getWishlist()).open.map((i) => i.name)).toEqual(["Mine"]);
    await signInAs(bob);
    expect((await getWishlist()).open.map((i) => i.name)).toEqual(["Bob's"]);
  });
});

describe("createWishlistItem", () => {
  it("creates an item owned by the signed-in user", async () => {
    const created = await createWishlistItem(
      input({ name: "Keyboard", price: 180.5, priority: "HIGH", url: "https://example.com/k", notes: "Brown switches" }),
    );

    const [row] = await itemsOf(alice.id);
    expect(row).toMatchObject({
      id: created.id,
      name: "Keyboard",
      priority: "HIGH",
      status: "WANTED",
      currency: "ILS",
      url: "https://example.com/k",
      notes: "Brown switches",
    });
    expect(row.price.toString()).toBe("180.5");
    expect(created).toEqual({
      id: row.id,
      name: "Keyboard",
      price: 180.5,
      currency: "ILS",
      priority: "HIGH",
      status: "WANTED",
      url: "https://example.com/k",
      notes: "Brown switches",
    });
    expect(await itemsOf(bob.id)).toEqual([]);
  });

  it("allows two items with the same name", async () => {
    await createWishlistItem(input());
    await createWishlistItem(input());

    expect(await itemsOf(alice.id)).toHaveLength(2);
  });

  it("sends signed-out callers to /login", async () => {
    signOut();

    await expect(createWishlistItem(input())).rejects.toMatchObject({
      digest: expect.stringContaining("/login"),
    });
    expect(await prisma.wishlistItem.count()).toBe(0);
  });
});

describe("updateWishlistItem", () => {
  it("changes the item and returns it", async () => {
    const [id] = await seed({ name: "Desk", price: 600 });

    const updated = await updateWishlistItem(
      id,
      input({ name: "Standing desk", price: 650.25, priority: "HIGH", status: "SAVING", url: "https://example.com", notes: "Wait for a sale" }),
    );

    expect(updated).toEqual({
      id,
      name: "Standing desk",
      price: 650.25,
      currency: "ILS",
      priority: "HIGH",
      status: "SAVING",
      url: "https://example.com",
      notes: "Wait for a sale",
    });
    expect(await itemsOf(alice.id)).toHaveLength(1);
  });

  it("clears the link and notes", async () => {
    const [id] = await seed({ name: "Desk" });
    await prisma.wishlistItem.update({ where: { id }, data: { url: "https://example.com", notes: "x" } });

    await updateWishlistItem(id, input({ url: null, notes: null }));

    expect(await prisma.wishlistItem.findUnique({ where: { id } })).toMatchObject({ url: null, notes: null });
  });

  it("can't change another user's item, even with its id", async () => {
    const [bobsId] = await seed({ userId: bob.id, name: "Bob's", price: 10 });

    await expect(updateWishlistItem(bobsId, input({ name: "Hijacked" }))).rejects.toMatchObject(
      appError("NOT_FOUND"),
    );

    expect(await prisma.wishlistItem.findUnique({ where: { id: bobsId } })).toMatchObject({ name: "Bob's" });
  });

  it("reports an item that doesn't exist", async () => {
    await expect(updateWishlistItem("missing", input())).rejects.toMatchObject(appError("NOT_FOUND"));
  });

  it("refuses to change a purchased item: its expense was recorded with the price it had", async () => {
    const [id] = await seed({ name: "Shoes", price: 140, status: "PURCHASED" });

    await expect(updateWishlistItem(id, input({ name: "Boots", price: 999 }))).rejects.toMatchObject(
      appError("INVALID_REFERENCE"),
    );

    const row = await prisma.wishlistItem.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ name: "Shoes", status: "PURCHASED" });
    expect(row.price.toString()).toBe("140");
  });

  it("sends signed-out callers to /login", async () => {
    const [id] = await seed({ name: "Desk" });
    signOut();

    await expect(updateWishlistItem(id, input())).rejects.toMatchObject({
      digest: expect.stringContaining("/login"),
    });
  });
});

describe("deleteWishlistItem", () => {
  it("deletes one's own item and only that one", async () => {
    const [id] = await seed({ name: "Desk" }, { name: "Keyboard" });

    await deleteWishlistItem(id);

    expect((await itemsOf(alice.id)).map((i) => i.name)).toEqual(["Keyboard"]);
  });

  it("can't delete another user's item", async () => {
    const [bobsId] = await seed({ userId: bob.id, name: "Bob's" });

    await expect(deleteWishlistItem(bobsId)).rejects.toMatchObject(appError("NOT_FOUND"));

    expect(await itemsOf(bob.id)).toHaveLength(1);
  });

  it("reports an item that doesn't exist, including one that was already deleted", async () => {
    const [id] = await seed({ name: "Desk" });
    await deleteWishlistItem(id);

    await expect(deleteWishlistItem(id)).rejects.toMatchObject(appError("NOT_FOUND"));
  });

  it("leaves the expense of a purchased item in place", async () => {
    const [id] = await seed({ name: "Desk", price: 620 });
    await purchaseWishlistItem(id, { categoryId: groceries, date: "2026-10-29" });

    await deleteWishlistItem(id);

    expect(await itemsOf(alice.id)).toEqual([]);
    expect(await transactionsOf(alice.id)).toHaveLength(1);
  });
});

describe("purchaseWishlistItem", () => {
  it("marks the item purchased and records its name and price as an expense", async () => {
    const [id] = await seed({ name: "Standing desk", price: "620.50" });

    await purchaseWishlistItem(id, { categoryId: groceries, date: "2026-10-29" });

    expect(await prisma.wishlistItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "PURCHASED" });
    const [transaction] = await transactionsOf(alice.id);
    expect(transaction).toMatchObject({
      categoryId: groceries,
      description: "Standing desk",
      type: "EXPENSE",
      currency: "ILS",
      note: null,
    });
    expect(transaction.amount.toString()).toBe("620.5");
    expect(transaction.date.toISOString()).toBe("2026-10-29T00:00:00.000Z");
  });

  it("moves the item to the purchased list and its price to the purchased total", async () => {
    const [id] = await seed({ name: "Desk", price: 620 }, { name: "Keyboard", price: 180 });

    await purchaseWishlistItem(id, { categoryId: groceries, date: "2026-10-29" });

    const { open, purchased, openTotal, purchasedTotal } = await getWishlist();
    expect(open.map((i) => i.name)).toEqual(["Keyboard"]);
    expect(purchased.map((i) => i.name)).toEqual(["Desk"]);
    expect([openTotal, purchasedTotal]).toEqual([180, 620]);
  });

  it("works for an item that is being saved for", async () => {
    const [id] = await seed({ name: "Monitor", status: "SAVING" });

    await purchaseWishlistItem(id, { categoryId: groceries, date: "2026-10-29" });

    expect(await prisma.wishlistItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "PURCHASED" });
  });

  it("can't buy the same item twice: only one expense is recorded", async () => {
    const [id] = await seed({ name: "Desk" });
    await purchaseWishlistItem(id, { categoryId: groceries, date: "2026-10-29" });

    await expect(purchaseWishlistItem(id, { categoryId: groceries, date: "2026-10-30" })).rejects.toMatchObject(
      appError("DUPLICATE"),
    );

    expect(await transactionsOf(alice.id)).toHaveLength(1);
  });

  it("records one expense when several purchases race", async () => {
    const [id] = await seed({ name: "Desk" });

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => purchaseWishlistItem(id, { categoryId: groceries, date: "2026-10-29" })),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await transactionsOf(alice.id)).toHaveLength(1);
  });

  it.each([
    ["another user's category", () => bobFood],
    ["an income category", () => salary],
    ["a category that doesn't exist", () => "missing"],
  ])("refuses %s, and then neither the item nor the transactions change", async (_name, pick) => {
    const [id] = await seed({ name: "Desk" });

    await expect(purchaseWishlistItem(id, { categoryId: pick(), date: "2026-10-29" })).rejects.toMatchObject(
      appError("INVALID_REFERENCE"),
    );

    expect(await prisma.wishlistItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "WANTED" });
    expect(await prisma.transaction.count()).toBe(0);
  });

  it("can't buy another user's item, even with a category of one's own", async () => {
    const [bobsId] = await seed({ userId: bob.id, name: "Bob's" });

    await expect(purchaseWishlistItem(bobsId, { categoryId: groceries, date: "2026-10-29" })).rejects.toMatchObject(
      appError("NOT_FOUND"),
    );

    expect(await prisma.wishlistItem.findUniqueOrThrow({ where: { id: bobsId } })).toMatchObject({ status: "WANTED" });
    expect(await prisma.transaction.count()).toBe(0);
  });

  it("reports an item that doesn't exist", async () => {
    await expect(purchaseWishlistItem("missing", { categoryId: groceries, date: "2026-10-29" })).rejects.toMatchObject(
      appError("NOT_FOUND"),
    );
  });

  it("sends signed-out callers to /login", async () => {
    const [id] = await seed({ name: "Desk" });
    signOut();

    await expect(purchaseWishlistItem(id, { categoryId: groceries, date: "2026-10-29" })).rejects.toMatchObject({
      digest: expect.stringContaining("/login"),
    });
    expect(await prisma.transaction.count()).toBe(0);
  });
});
