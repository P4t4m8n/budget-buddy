import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth/dal";
import { BASE_CURRENCY } from "@/lib/constants";
import { AppError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";
import type { ImportRowInput } from "@/lib/validation/transaction-import";
import type { TransactionInput } from "@/lib/validation/transaction";
import type { Transaction, TransactionType } from "@/types/finance";
import { toAppError } from "./prisma-errors";
import { fromDateString, toDateString, toNumber } from "./serialize";

const select = {
  id: true,
  categoryId: true,
  description: true,
  amount: true,
  currency: true,
  type: true,
  date: true,
  note: true,
} satisfies Prisma.TransactionSelect;

type Row = Prisma.TransactionGetPayload<{ select: typeof select }>;

const toTransaction = (row: Row): Transaction => ({
  ...row,
  amount: toNumber(row.amount),
  date: toDateString(row.date),
});

const toData = (input: TransactionInput) => ({
  description: input.description,
  amount: input.amount,
  currency: input.currency,
  type: input.type,
  categoryId: input.categoryId,
  date: fromDateString(input.date),
  note: input.note,
});

// Without this check a user could attach a transaction to someone else's category
async function assertOwnCategoryOfType(
  userId: string,
  categoryId: string,
  type: TransactionType,
) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { type: true },
  });
  if (!category || category.type !== type) {
    throw AppError.invalidReference(
      "Choose one of your categories that matches the transaction type",
      "categoryId",
    );
  }
}

export async function getTransactions(): Promise<Transaction[]> {
  const user = await requireUser();

  const rows = await prisma.transaction.findMany({
    where: { userId: user.id },
    select,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toTransaction);
}

// The newest transactions, in the same order as the full list
export async function getRecentTransactions(
  limit: number,
): Promise<Transaction[]> {
  const user = await requireUser();

  const rows = await prisma.transaction.findMany({
    where: { userId: user.id },
    select,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(toTransaction);
}

export async function createTransaction(
  input: TransactionInput,
): Promise<Transaction> {
  const user = await requireUser();
  await assertOwnCategoryOfType(user.id, input.categoryId, input.type);

  const row = await prisma.transaction.create({
    data: { ...toData(input), userId: user.id },
    select,
  });
  return toTransaction(row);
}

export async function updateTransaction(
  id: string,
  input: TransactionInput,
): Promise<Transaction> {
  const user = await requireUser();
  await assertOwnCategoryOfType(user.id, input.categoryId, input.type);

  const { count } = await prisma.transaction.updateMany({
    where: { id, userId: user.id },
    data: toData(input),
  });
  if (count === 0) throw AppError.notFound("transaction");

  const row = await prisma.transaction.findFirstOrThrow({
    where: { id, userId: user.id },
    select,
  });
  return toTransaction(row);
}

export async function deleteTransaction(id: string): Promise<void> {
  const user = await requireUser();

  const { count } = await prisma.transaction.deleteMany({
    where: { id, userId: user.id },
  });
  if (count === 0) throw AppError.notFound("transaction");
}

const invalidImportCategory = () =>
  AppError.invalidReference("Choose one of your expense categories for every row");

// Adds all the rows as expenses in ILS, or none of them: it is one INSERT. Returns how many
// were added. Every category has to be one of the user's own expense categories.
export async function createTransactions(
  rows: ImportRowInput[],
): Promise<number> {
  const user = await requireUser();

  // Without this check a user could file expenses under someone else's categories
  const categoryIds = [...new Set(rows.map((row) => row.categoryId))];
  const owned = await prisma.category.count({
    where: { id: { in: categoryIds }, userId: user.id, type: "EXPENSE" },
  });
  if (owned !== categoryIds.length) throw invalidImportCategory();

  try {
    const { count } = await prisma.transaction.createMany({
      data: rows.map((row) => ({
        userId: user.id,
        categoryId: row.categoryId,
        description: row.description,
        amount: row.amount,
        currency: BASE_CURRENCY,
        type: "EXPENSE" as const,
        date: fromDateString(row.date),
      })),
    });
    return count;
  } catch (error) {
    // A category was deleted between the check and the write
    throw toAppError(error, { P2003: invalidImportCategory });
  }
}
