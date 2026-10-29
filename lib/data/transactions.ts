import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import type { TransactionInput } from "@/lib/validation/transaction";
import type { Transaction, TransactionType } from "@/types/finance";
import { CategoryMismatchError, NotFoundError } from "./errors";
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
  if (!category || category.type !== type) throw new CategoryMismatchError();
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
  if (count === 0) throw new NotFoundError("Transaction");

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
  if (count === 0) throw new NotFoundError("Transaction");
}
