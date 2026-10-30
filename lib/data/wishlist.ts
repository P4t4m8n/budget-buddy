import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth/dal";
import { BASE_CURRENCY } from "@/lib/constants";
import { AppError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";
import type { PurchaseInput, WishlistInput } from "@/lib/validation/wishlist";
import type { WishlistItem } from "@/types/finance";
import { toAppError } from "./prisma-errors";
import { fromDateString, toNumber } from "./serialize";

// Every function resolves the signed-in user itself and scopes all queries to them.
// Input is expected to be validated already (lib/validation).

const select = {
  id: true,
  name: true,
  price: true,
  currency: true,
  priority: true,
  status: true,
  url: true,
  notes: true,
} satisfies Prisma.WishlistItemSelect;

type Row = Prisma.WishlistItemGetPayload<{ select: typeof select }>;

const toItem = (row: Row): WishlistItem => ({
  ...row,
  price: toNumber(row.price),
});

const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

const invalidCategory = () =>
  AppError.invalidReference("Choose one of your expense categories", "categoryId");

const alreadyPurchased = () =>
  AppError.duplicate("This item is already marked as purchased");

export type WishlistOverview = {
  // Items still to buy: most wanted first, then by name
  open: WishlistItem[];
  purchased: WishlistItem[];
  openTotal: number;
  purchasedTotal: number;
};

// Only ILS prices are added up until currency conversion exists
export const getWishlist = async (): Promise<WishlistOverview> => {
  const user = await requireUser();

  const rows = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    select,
  });

  const byName = (a: Row, b: Row) => a.name.localeCompare(b.name);
  const open = rows
    .filter((row) => row.status !== "PURCHASED")
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || byName(a, b));
  const purchased = rows.filter((row) => row.status === "PURCHASED").sort(byName);

  const total = (list: Row[]) =>
    list
      .filter((row) => row.currency === BASE_CURRENCY)
      .reduce((sum, row) => sum.plus(row.price), new Prisma.Decimal(0));

  return {
    open: open.map(toItem),
    purchased: purchased.map(toItem),
    openTotal: toNumber(total(open)),
    purchasedTotal: toNumber(total(purchased)),
  };
};

export const createWishlistItem = async (
  input: WishlistInput,
): Promise<WishlistItem> => {
  const user = await requireUser();

  const row = await prisma.wishlistItem.create({
    data: { ...input, userId: user.id },
    select,
  });
  return toItem(row);
};

// A purchased item is final: its expense was recorded with the price it had
export const updateWishlistItem = async (
  id: string,
  input: WishlistInput,
): Promise<WishlistItem> => {
  const user = await requireUser();

  const { count } = await prisma.wishlistItem.updateMany({
    where: { id, userId: user.id, status: { not: "PURCHASED" } },
    data: input,
  });

  if (count === 0) {
    const item = await prisma.wishlistItem.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!item) throw AppError.notFound("wishlist item");
    throw AppError.invalidReference("A purchased item can't be changed");
  }

  const row = await prisma.wishlistItem.findFirstOrThrow({
    where: { id, userId: user.id },
    select,
  });
  return toItem(row);
};

// Deleting a purchased item leaves its expense transaction in place
export const deleteWishlistItem = async (id: string): Promise<void> => {
  const user = await requireUser();

  const { count } = await prisma.wishlistItem.deleteMany({
    where: { id, userId: user.id },
  });
  if (count === 0) throw AppError.notFound("wishlist item");
};

// Marks the item as purchased and records it as an expense, both or neither
export const purchaseWishlistItem = async (
  id: string,
  input: PurchaseInput,
): Promise<void> => {
  const user = await requireUser();

  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.wishlistItem.findFirst({
        where: { id, userId: user.id },
        select: { name: true, price: true, currency: true, status: true },
      });
      if (!item) throw AppError.notFound("wishlist item");
      if (item.status === "PURCHASED") throw alreadyPurchased();

      // Without this check a user could file the expense under someone else's category,
      // or under an income category
      const category = await tx.category.findFirst({
        where: { id: input.categoryId, userId: user.id, type: "EXPENSE" },
        select: { id: true },
      });
      if (!category) throw invalidCategory();

      // Two tabs buying the same item: only one of them gets past this
      const { count } = await tx.wishlistItem.updateMany({
        where: { id, userId: user.id, status: { not: "PURCHASED" } },
        data: { status: "PURCHASED" },
      });
      if (count === 0) throw alreadyPurchased();

      await tx.transaction.create({
        data: {
          userId: user.id,
          categoryId: input.categoryId,
          description: item.name,
          amount: item.price,
          currency: item.currency,
          type: "EXPENSE",
          date: fromDateString(input.date),
        },
      });
    });
  } catch (error) {
    // The category was deleted between the check and the write
    throw toAppError(error, { P2003: invalidCategory });
  }
};
