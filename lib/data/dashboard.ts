import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth/dal";
import { APP_TIME_ZONE, BASE_CURRENCY } from "@/lib/constants";
import { currentMonth, monthBounds, recentMonths } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type {
  Dashboard,
  MonthlyTotals,
  SpendingSlice,
} from "@/types/dashboard";
import type { TransactionType } from "@/types/finance";
import { getCategories } from "./categories";
import { fromDateString, toNumber } from "./serialize";
import { getRecentTransactions } from "./transactions";

const MONTHS_IN_CHART = 6;
const RECENT_COUNT = 6;

// Everything here is summed by the database, in exact decimals, and only turned into a
// number at the very end. Only ILS is summed until currency conversion exists, so amounts
// in different currencies are never added together.

type TypeTotals = { income: Prisma.Decimal; expense: Prisma.Decimal };

const zero = (): TypeTotals => ({
  income: new Prisma.Decimal(0),
  expense: new Prisma.Decimal(0),
});

const addTotal = (
  totals: TypeTotals,
  type: TransactionType,
  amount: Prisma.Decimal,
) => {
  if (type === "INCOME") totals.income = totals.income.plus(amount);
  else totals.expense = totals.expense.plus(amount);
};

// `now` is only for tests: the app always uses the current time
export const getDashboard = async (
  options: { now?: Date } = {},
): Promise<Dashboard> => {
  const user = await requireUser();
  // Read after the session lookup, so the page stays dynamic instead of being prerendered
  const now = options.now ?? new Date();

  const month = currentMonth(now, APP_TIME_ZONE);
  const months = recentMonths(month, MONTHS_IN_CHART);
  const thisMonth = monthBounds(month);
  const chartStart = monthBounds(months[0]).start;

  const [balanceRows, monthlyRows, spendingRows, categories, recent] =
    await Promise.all([
      prisma.transaction.groupBy({
        by: ["type"],
        where: { userId: user.id, currency: BASE_CURRENCY },
        _sum: { amount: true },
      }),
      prisma.$queryRaw<
        { month: string; type: TransactionType; total: Prisma.Decimal }[]
      >(Prisma.sql`
        select to_char("date", 'YYYY-MM') as month, "type", sum("amount") as total
        from "Transaction"
        where "userId" = ${user.id}
          and "currency" = ${BASE_CURRENCY}::"Currency"
          and "date" >= ${chartStart}::date
          and "date" < ${thisMonth.end}::date
        group by 1, 2
      `),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: {
          userId: user.id,
          currency: BASE_CURRENCY,
          type: "EXPENSE",
          date: {
            gte: fromDateString(thisMonth.start),
            lt: fromDateString(thisMonth.end),
          },
        },
        _sum: { amount: true },
      }),
      getCategories(),
      getRecentTransactions(RECENT_COUNT),
    ]);

  const balance = zero();
  for (const row of balanceRows) {
    addTotal(balance, row.type, row._sum.amount ?? new Prisma.Decimal(0));
  }

  const byMonth = new Map(months.map((m) => [m, zero()]));
  for (const row of monthlyRows) {
    const totals = byMonth.get(row.month);
    if (totals) addTotal(totals, row.type, new Prisma.Decimal(row.total));
  }

  const monthlyTotals: MonthlyTotals[] = months.map((m) => {
    const totals = byMonth.get(m)!;
    return {
      month: m,
      income: toNumber(totals.income),
      expenses: toNumber(totals.expense),
    };
  });
  const current = monthlyTotals[monthlyTotals.length - 1];

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const spendingByCategory: SpendingSlice[] = spendingRows
    .map((row) => {
      const category = categoryById.get(row.categoryId);
      return {
        id: row.categoryId,
        label: category?.name ?? "Unknown",
        color: category?.color ?? "#737373",
        value: toNumber(row._sum.amount ?? new Prisma.Decimal(0)),
      };
    })
    .sort((a, b) => b.value - a.value);

  return {
    month,
    balance: toNumber(balance.income.minus(balance.expense)),
    income: current.income,
    spending: current.expenses,
    spendingByCategory,
    monthlyTotals,
    recent: recent.map((t) => ({
      ...t,
      categoryName: categoryById.get(t.categoryId)?.name ?? "Unknown",
    })),
  };
};
