import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth/dal";
import { AppError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";
import { toAppError } from "./prisma-errors";

import type { CategoryInput, CategoryUpdate } from "@/lib/validation/category";
import type { Category } from "@/types/finance";

const select = {
  id: true,
  name: true,
  type: true,
  color: true,
} satisfies Prisma.CategorySelect;

const duplicateCategory = () =>
  AppError.duplicate("You already have a category with this name and type", "name");

const categoryInUse = (transactions: number, budgets: number) =>
  AppError.inUse("This category is still used by transactions or budgets", {
    transactions,
    budgets,
  });

// Every function resolves the signed-in user itself and scopes all queries to them.
// Input is expected to be validated already (lib/validation).

export const getCategories = async (): Promise<Category[]> => {
  const user = await requireUser();

  return prisma.category.findMany({
    where: { userId: user.id },
    select,
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
};

export const createCategory = async (
  input: CategoryInput,
): Promise<Category> => {
  const user = await requireUser();

  try {
    return await prisma.category.create({
      data: { ...input, userId: user.id },
      select,
    });
  } catch (error) {
    throw toAppError(error, { P2002: duplicateCategory });
  }
};

export const updateCategory = async (
  id: string,
  input: CategoryUpdate,
): Promise<Category> => {
  const user = await requireUser();

  try {
    const { count } = await prisma.category.updateMany({
      where: { id, userId: user.id },
      // Only these two, even if the caller passes more: the type must never change
      data: { name: input.name, color: input.color },
    });
    if (count === 0) throw AppError.notFound("category");
  } catch (error) {
    throw toAppError(error, { P2002: duplicateCategory });
  }

  return prisma.category.findFirstOrThrow({
    where: { id, userId: user.id },
    select,
  });
};

export const deleteCategory = async (id: string): Promise<void> => {
  const user = await requireUser();

  const category = await prisma.category.findFirst({
    where: { id, userId: user.id },
    select: { _count: { select: { transactions: true, budgets: true } } },
  });
  if (!category) throw AppError.notFound("category");

  const { transactions, budgets } = category._count;
  if (transactions > 0 || budgets > 0) {
    throw categoryInUse(transactions, budgets);
  }

  try {
    await prisma.category.deleteMany({ where: { id, userId: user.id } });
  } catch (error) {
    // Something started using it between the check and the delete
    throw toAppError(error, { P2003: () => categoryInUse(0, 0) });
  }
};
