import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth/dal";
import { APP_TIME_ZONE, BASE_CURRENCY } from "@/lib/constants";
import { currentDate } from "@/lib/dates";
import { AppError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";
import type {
  InvestmentInput,
  InvestmentUpdate,
  ValueUpdate,
} from "@/lib/validation/investment";
import type { Investment } from "@/types/finance";
import type {
  InvestmentRow,
  InvestmentsOverview,
} from "@/types/investments";
import { toAppError } from "./prisma-errors";
import { fromDateString, toDateString, toNumber } from "./serialize";

// Every function resolves the signed-in user itself and scopes all queries to them.
// Input is expected to be validated already (lib/validation).

const select = {
  id: true,
  name: true,
  type: true,
  ticker: true,
  amountInvested: true,
  currentValue: true,
  currency: true,
  purchaseDate: true,
} satisfies Prisma.InvestmentSelect;

type Row = Prisma.InvestmentGetPayload<{ select: typeof select }>;

const toInvestment = (row: Row): Investment => ({
  ...row,
  amountInvested: toNumber(row.amountInvested),
  currentValue: toNumber(row.currentValue),
  purchaseDate: toDateString(row.purchaseDate),
});

const zero = () => new Prisma.Decimal(0);

// `now` is only for tests: the app always uses the current time. The day is the user's
// own, which can differ from the server's.
const today = (now: Date | undefined) =>
  fromDateString(currentDate(now ?? new Date(), APP_TIME_ZONE));

// Every investment with its return, the portfolio totals, and the history of values.
// Only ILS investments are added up until currency conversion exists.
export const getInvestmentsOverview = async (): Promise<InvestmentsOverview> => {
  const user = await requireUser();

  const [rows, snapshots] = await Promise.all([
    prisma.investment.findMany({
      where: { userId: user.id },
      select,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.investmentSnapshot.findMany({
      where: { userId: user.id },
      select: { investmentId: true, value: true, date: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const dates = [...new Set(snapshots.map((s) => toDateString(s.date)))];
  const dateIndex = new Map(dates.map((date, index) => [date, index]));

  const valuesByInvestment = new Map<string, (number | null)[]>();
  const countByInvestment = new Map<string, number>();
  for (const snapshot of snapshots) {
    const values =
      valuesByInvestment.get(snapshot.investmentId) ??
      dates.map(() => null as number | null);
    values[dateIndex.get(toDateString(snapshot.date))!] = toNumber(
      snapshot.value,
    );
    valuesByInvestment.set(snapshot.investmentId, values);
    countByInvestment.set(
      snapshot.investmentId,
      (countByInvestment.get(snapshot.investmentId) ?? 0) + 1,
    );
  }

  let totalInvested = zero();
  let portfolioValue = zero();
  const investments: InvestmentRow[] = rows.map((row) => {
    if (row.currency === BASE_CURRENCY) {
      totalInvested = totalInvested.plus(row.amountInvested);
      portfolioValue = portfolioValue.plus(row.currentValue);
    }

    const gainPercent = row.amountInvested.isZero()
      ? 0
      : row.currentValue
          .minus(row.amountInvested)
          .div(row.amountInvested)
          .times(100)
          .toDecimalPlaces(2)
          .toNumber();

    return {
      ...toInvestment(row),
      gainPercent,
      snapshotCount: countByInvestment.get(row.id) ?? 0,
    };
  });

  return {
    investments,
    totalInvested: toNumber(totalInvested),
    portfolioValue: toNumber(portfolioValue),
    gain: toNumber(portfolioValue.minus(totalInvested)),
    history: {
      dates,
      series: rows
        .filter((row) => valuesByInvestment.has(row.id))
        .map((row) => ({
          id: row.id,
          label: row.name,
          data: valuesByInvestment.get(row.id)!,
        })),
    },
  };
};

// Its starting value is recorded as the first point of its history
export const createInvestment = async (
  input: InvestmentInput,
  options: { now?: Date } = {},
): Promise<Investment> => {
  const user = await requireUser();
  const day = today(options.now);

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.investment.create({
      data: {
        userId: user.id,
        name: input.name,
        type: input.type,
        ticker: input.ticker,
        amountInvested: input.amountInvested,
        currentValue: input.currentValue,
        currency: input.currency,
        purchaseDate: fromDateString(input.purchaseDate),
      },
      select,
    });
    await tx.investmentSnapshot.create({
      data: {
        userId: user.id,
        investmentId: created.id,
        value: input.currentValue,
        date: day,
      },
    });
    return created;
  });
  return toInvestment(row);
};

// Everything but the current value, which has its own action
export const updateInvestment = async (
  id: string,
  input: InvestmentUpdate,
): Promise<Investment> => {
  const user = await requireUser();

  const { count } = await prisma.investment.updateMany({
    where: { id, userId: user.id },
    data: {
      name: input.name,
      type: input.type,
      ticker: input.ticker,
      amountInvested: input.amountInvested,
      purchaseDate: fromDateString(input.purchaseDate),
    },
  });
  if (count === 0) throw AppError.notFound("investment");

  const row = await prisma.investment.findFirstOrThrow({
    where: { id, userId: user.id },
    select,
  });
  return toInvestment(row);
};

// Sets what the investment is worth today and records it in the history. Updating it
// again the same day replaces that day's value instead of adding another.
export const updateInvestmentValue = async (
  id: string,
  input: ValueUpdate,
  options: { now?: Date } = {},
): Promise<Investment> => {
  const user = await requireUser();
  const day = today(options.now);

  const row = await prisma
    .$transaction(async (tx) => {
      // Without this check a user could record a value for someone else's investment
      const owned = await tx.investment.findFirst({
        where: { id, userId: user.id },
        select: { id: true },
      });
      if (!owned) throw AppError.notFound("investment");

      // Two updates on the same day queue up on that day's row, so the history and the
      // current value always end up with the same one
      await tx.investmentSnapshot.upsert({
        where: { investmentId_date: { investmentId: id, date: day } },
        create: {
          userId: user.id,
          investmentId: id,
          value: input.value,
          date: day,
        },
        update: { value: input.value },
      });
      return tx.investment.update({
        where: { id },
        data: { currentValue: input.value },
        select,
      });
    })
    // Deleted between the check and the write
    .catch((error) => {
      throw toAppError(error, { P2003: () => AppError.notFound("investment") });
    });
  return toInvestment(row);
};

// Its history goes with it
export const deleteInvestment = async (id: string): Promise<void> => {
  const user = await requireUser();

  const { count } = await prisma.investment.deleteMany({
    where: { id, userId: user.id },
  });
  if (count === 0) throw AppError.notFound("investment");
};
