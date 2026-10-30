import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth/dal";
import { APP_TIME_ZONE, BASE_CURRENCY } from "@/lib/constants";
import { currentMonth, monthBounds, parseMonth } from "@/lib/dates";
import { AppError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";
import type { BudgetInput } from "@/lib/validation/budget";
import type { BudgetOverview, BudgetRow } from "@/types/budget";
import { toAppError } from "./prisma-errors";
import { fromDateString, toNumber } from "./serialize";

// Every function resolves the signed-in user itself and scopes all queries to them.
// Input is expected to be validated already (lib/validation).

const invalidCategory = () =>
  AppError.invalidReference(
    "Choose one of your expense categories",
    "categoryId",
  );

const zero = () => new Prisma.Decimal(0);

// Every expense category of the user for one month: its budget (if any) next to what was spent.
// Only ILS spending is counted until currency conversion exists. `month` is "YYYY-MM" and
// falls back to the current month when missing or invalid; `now` is only for tests.
export const getBudgetOverview = async (
  options: { month?: string; now?: Date } = {},
): Promise<BudgetOverview> => {
  const user = await requireUser();
  // Read after the session lookup, so the page stays dynamic instead of being prerendered
  const now = options.now ?? new Date();

  const thisMonth = currentMonth(now, APP_TIME_ZONE);
  const month = parseMonth(options.month) ?? thisMonth;
  const { start, end } = monthBounds(month);

  const [categories, budgets, spendingRows] = await Promise.all([
    prisma.category.findMany({
      where: { userId: user.id, type: "EXPENSE" },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.budget.findMany({
      where: { userId: user.id, month: fromDateString(start) },
      select: { id: true, categoryId: true, limit: true, currency: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId: user.id,
        currency: BASE_CURRENCY,
        type: "EXPENSE",
        date: { gte: fromDateString(start), lt: fromDateString(end) },
      },
      _sum: { amount: true },
    }),
  ]);

  const budgetByCategory = new Map(budgets.map((b) => [b.categoryId, b]));
  const spentByCategory = new Map(
    spendingRows.map((row) => [row.categoryId, row._sum.amount ?? zero()]),
  );

  let totalBudget = zero();
  let budgetedSpent = zero();
  let unbudgetedSpent = zero();

  const rows: BudgetRow[] = categories.map((category) => {
    const budget = budgetByCategory.get(category.id);
    const spent = spentByCategory.get(category.id) ?? zero();

    if (budget) {
      totalBudget = totalBudget.plus(budget.limit);
      budgetedSpent = budgetedSpent.plus(spent);
    } else {
      unbudgetedSpent = unbudgetedSpent.plus(spent);
    }

    return {
      categoryId: category.id,
      name: category.name,
      color: category.color,
      budgetId: budget?.id ?? null,
      limit: budget ? toNumber(budget.limit) : null,
      currency: budget?.currency ?? BASE_CURRENCY,
      spent: toNumber(spent),
    };
  });

  // Budgeted categories first; each group stays sorted by name
  rows.sort((a, b) => Number(b.budgetId !== null) - Number(a.budgetId !== null));

  return {
    month,
    thisMonth,
    rows,
    totalBudget: toNumber(totalBudget),
    budgetedSpent: toNumber(budgetedSpent),
    unbudgetedSpent: toNumber(unbudgetedSpent),
  };
};

// Creates the month's budget for the category, or changes its limit when there is one already
export const setBudget = async (input: BudgetInput): Promise<void> => {
  const user = await requireUser();

  // Without this check a user could budget someone else's category, or an income category
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, userId: user.id, type: "EXPENSE" },
    select: { id: true },
  });
  if (!category) throw invalidCategory();

  const month = fromDateString(`${input.month}-01`);

  try {
    await prisma.budget.upsert({
      where: {
        userId_categoryId_month: {
          userId: user.id,
          categoryId: input.categoryId,
          month,
        },
      },
      create: {
        userId: user.id,
        categoryId: input.categoryId,
        month,
        limit: input.limit,
        currency: input.currency,
      },
      update: { limit: input.limit, currency: input.currency },
    });
  } catch (error) {
    // The category was deleted between the check and the write
    throw toAppError(error, { P2003: invalidCategory });
  }
};

export const deleteBudget = async (id: string): Promise<void> => {
  const user = await requireUser();

  const { count } = await prisma.budget.deleteMany({
    where: { id, userId: user.id },
  });
  if (count === 0) throw AppError.notFound("budget");
};
