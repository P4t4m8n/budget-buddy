import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth/dal";
import { BASE_CURRENCY } from "@/lib/constants";
import { AppError } from "@/lib/errors/app-error";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { DepositInput, GoalInput } from "@/lib/validation/savings";
import type { SavingsGoalProgress, SavingsOverview } from "@/types/savings";
import type { Currency, SavingsDeposit, SavingsGoal } from "@/types/finance";
import { fromDateString, toDateString, toNumber } from "./serialize";

// Every function resolves the signed-in user itself and scopes all queries to them.
// Input is expected to be validated already (lib/validation).

const goalSelect = {
  id: true,
  name: true,
  targetAmount: true,
  currency: true,
  targetDate: true,
} satisfies Prisma.SavingsGoalSelect;

const depositSelect = {
  id: true,
  goalId: true,
  amount: true,
  date: true,
  note: true,
} satisfies Prisma.SavingsDepositSelect;

type GoalRow = Prisma.SavingsGoalGetPayload<{ select: typeof goalSelect }>;
type DepositRow = Prisma.SavingsDepositGetPayload<{ select: typeof depositSelect }>;

const toGoal = (row: GoalRow): SavingsGoal => ({
  ...row,
  targetAmount: toNumber(row.targetAmount),
  targetDate: row.targetDate ? toDateString(row.targetDate) : null,
});

const toDeposit = (row: DepositRow): SavingsDeposit => ({
  ...row,
  amount: toNumber(row.amount),
  date: toDateString(row.date),
});

const zero = () => new Prisma.Decimal(0);

const belowZero = (balance: Prisma.Decimal, currency: Currency) =>
  AppError.invalidReference(
    `This would take the goal below zero (it would end up at ${formatCurrency(balance.toNumber(), currency)})`,
    "amount",
  );

// Runs `work` with the goal's row locked, so two changes to the same goal (a withdrawal and
// a delete, say) queue up instead of both reading the same balance. `balance` is what the
// goal holds once the lock is taken.
const withLockedGoal = async <T>(
  userId: string,
  goalId: string,
  missing: string,
  work: (
    tx: Prisma.TransactionClient,
    goal: { balance: Prisma.Decimal; currency: Currency },
  ) => Promise<T>,
): Promise<T> =>
  prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ currency: Currency }[]>(Prisma.sql`
      select "currency" from "SavingsGoal"
      where "id" = ${goalId} and "userId" = ${userId}
      for update
    `);
    if (rows.length === 0) throw AppError.notFound(missing);

    const { _sum } = await tx.savingsDeposit.aggregate({
      where: { goalId },
      _sum: { amount: true },
    });
    return work(tx, { balance: _sum.amount ?? zero(), currency: rows[0].currency });
  });

// Every goal with its balance and deposit history. Only ILS balances are added up until
// currency conversion exists.
export const getSavingsOverview = async (): Promise<SavingsOverview> => {
  const user = await requireUser();

  const [goals, deposits] = await Promise.all([
    prisma.savingsGoal.findMany({
      where: { userId: user.id },
      select: goalSelect,
      orderBy: { name: "asc" },
    }),
    prisma.savingsDeposit.findMany({
      where: { userId: user.id },
      select: depositSelect,
      // cuids are roughly time-ordered, so entries of the same day stay in the order they were added
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
  ]);

  const byGoal = new Map<string, DepositRow[]>();
  for (const deposit of deposits) {
    byGoal.set(deposit.goalId, [...(byGoal.get(deposit.goalId) ?? []), deposit]);
  }

  let totalSaved = zero();
  const progress: SavingsGoalProgress[] = goals.map((goal) => {
    const rows = byGoal.get(goal.id) ?? [];
    const balance = rows.reduce((sum, row) => sum.plus(row.amount), zero());
    if (goal.currency === BASE_CURRENCY) totalSaved = totalSaved.plus(balance);

    return {
      ...toGoal(goal),
      currentAmount: toNumber(balance),
      deposits: rows.map(toDeposit),
    };
  });

  return { goals: progress, totalSaved: toNumber(totalSaved) };
};

export const createGoal = async (input: GoalInput): Promise<SavingsGoal> => {
  const user = await requireUser();

  const row = await prisma.savingsGoal.create({
    data: {
      userId: user.id,
      name: input.name,
      targetAmount: input.targetAmount,
      currency: input.currency,
      targetDate: input.targetDate ? fromDateString(input.targetDate) : null,
    },
    select: goalSelect,
  });
  return toGoal(row);
};

export const updateGoal = async (
  id: string,
  input: GoalInput,
): Promise<SavingsGoal> => {
  const user = await requireUser();

  const { count } = await prisma.savingsGoal.updateMany({
    where: { id, userId: user.id },
    data: {
      name: input.name,
      targetAmount: input.targetAmount,
      targetDate: input.targetDate ? fromDateString(input.targetDate) : null,
    },
  });
  if (count === 0) throw AppError.notFound("savings goal");

  const row = await prisma.savingsGoal.findFirstOrThrow({
    where: { id, userId: user.id },
    select: goalSelect,
  });
  return toGoal(row);
};

// Deleting a goal would delete its deposits with it, so a goal that has any is refused
export const deleteGoal = async (id: string): Promise<void> => {
  const user = await requireUser();

  await withLockedGoal(user.id, id, "savings goal", async (tx) => {
    const deposits = await tx.savingsDeposit.count({ where: { goalId: id } });
    if (deposits > 0) {
      throw AppError.inUse("This goal still has deposits. Delete them first.", {
        deposits,
      });
    }
    await tx.savingsGoal.deleteMany({ where: { id, userId: user.id } });
  });
};

// `input.amount` is signed: a withdrawal is negative, and can't take the goal below zero
export const addDeposit = async (
  goalId: string,
  input: DepositInput,
): Promise<SavingsDeposit> => {
  const user = await requireUser();

  return withLockedGoal(user.id, goalId, "savings goal", async (tx, goal) => {
    const after = goal.balance.plus(input.amount);
    if (after.lt(0)) throw belowZero(after, goal.currency);

    const row = await tx.savingsDeposit.create({
      data: {
        userId: user.id,
        goalId,
        amount: input.amount,
        date: fromDateString(input.date),
        note: input.note,
      },
      select: depositSelect,
    });
    return toDeposit(row);
  });
};

// The goal's other deposits can't be moved, only this one's amount, date and note
export const updateDeposit = async (
  id: string,
  input: DepositInput,
): Promise<SavingsDeposit> => {
  const user = await requireUser();
  const goalId = await goalOfDeposit(user.id, id);

  return withLockedGoal(user.id, goalId, "deposit", async (tx, goal) => {
    const current = await tx.savingsDeposit.findFirst({
      where: { id, userId: user.id },
      select: { amount: true },
    });
    if (!current) throw AppError.notFound("deposit");

    const after = goal.balance.minus(current.amount).plus(input.amount);
    if (after.lt(0)) throw belowZero(after, goal.currency);

    const row = await tx.savingsDeposit.update({
      where: { id },
      data: {
        amount: input.amount,
        date: fromDateString(input.date),
        note: input.note,
      },
      select: depositSelect,
    });
    return toDeposit(row);
  });
};

// Taking out a deposit that was already partly withdrawn would leave the goal below zero
export const deleteDeposit = async (id: string): Promise<void> => {
  const user = await requireUser();
  const goalId = await goalOfDeposit(user.id, id);

  await withLockedGoal(user.id, goalId, "deposit", async (tx, goal) => {
    const current = await tx.savingsDeposit.findFirst({
      where: { id, userId: user.id },
      select: { amount: true },
    });
    if (!current) throw AppError.notFound("deposit");

    const after = goal.balance.minus(current.amount);
    if (after.lt(0)) throw belowZero(after, goal.currency);

    await tx.savingsDeposit.delete({ where: { id } });
  });
};

const goalOfDeposit = async (userId: string, id: string): Promise<string> => {
  const deposit = await prisma.savingsDeposit.findFirst({
    where: { id, userId },
    select: { goalId: true },
  });
  if (!deposit) throw AppError.notFound("deposit");
  return deposit.goalId;
};
