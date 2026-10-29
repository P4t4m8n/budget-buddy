import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import type { CategoryInput, CategoryUpdate } from "@/lib/validation/category";
import type { Category } from "@/types/finance";
import {
  CategoryInUseError,
  DuplicateCategoryError,
  NotFoundError,
} from "./errors";

const select = {
  id: true,
  name: true,
  type: true,
  color: true,
} satisfies Prisma.CategorySelect;

const hasPrismaCode = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

// Every function resolves the signed-in user itself and scopes all queries to them.
// Input is expected to be validated already (lib/validation).

export async function getCategories(): Promise<Category[]> {
  const user = await requireUser();

  return prisma.category.findMany({
    where: { userId: user.id },
    select,
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const user = await requireUser();

  try {
    return await prisma.category.create({
      data: { ...input, userId: user.id },
      select,
    });
  } catch (error) {
    if (hasPrismaCode(error, "P2002")) throw new DuplicateCategoryError();
    throw error;
  }
}

export async function updateCategory(
  id: string,
  input: CategoryUpdate,
): Promise<Category> {
  const user = await requireUser();

  try {
    const { count } = await prisma.category.updateMany({
      where: { id, userId: user.id },
      // Only these two, even if the caller passes more: the type must never change
      data: { name: input.name, color: input.color },
    });
    if (count === 0) throw new NotFoundError("Category");
  } catch (error) {
    if (hasPrismaCode(error, "P2002")) throw new DuplicateCategoryError();
    throw error;
  }

  return prisma.category.findFirstOrThrow({
    where: { id, userId: user.id },
    select,
  });
}

export async function deleteCategory(id: string): Promise<void> {
  const user = await requireUser();

  const category = await prisma.category.findFirst({
    where: { id, userId: user.id },
    select: { _count: { select: { transactions: true, budgets: true } } },
  });
  if (!category) throw new NotFoundError("Category");

  const { transactions, budgets } = category._count;
  if (transactions > 0 || budgets > 0) {
    throw new CategoryInUseError(transactions, budgets);
  }

  try {
    await prisma.category.deleteMany({ where: { id, userId: user.id } });
  } catch (error) {
    // Something started using it between the check and the delete
    if (hasPrismaCode(error, "P2003")) throw new CategoryInUseError(0, 0);
    throw error;
  }
}
