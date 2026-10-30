import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);

import {
  addDeposit,
  createGoal,
  deleteDeposit,
  deleteGoal,
  getSavingsOverview,
  updateDeposit,
  updateGoal,
} from "@/lib/data/savings";
import { prisma } from "@/lib/prisma";
import { appError } from "../setup/app-error";
import { createUser, deleteTestUsers, signInAs, signOut } from "./support";

let alice: { id: string };
let bob: { id: string };

const goalInput = (overrides: Partial<Parameters<typeof createGoal>[0]> = {}) => ({
  name: "Emergency fund",
  targetAmount: 20000,
  currency: "ILS" as const,
  targetDate: null,
  ...overrides,
});

const entry = (amount: number, date = "2026-10-01", note: string | null = null) => ({ amount, date, note });

const seedGoal = async (name: string, userId = alice.id, targetAmount: number | string = 1000) =>
  (await prisma.savingsGoal.create({ data: { userId, name, targetAmount } })).id;

const seedDeposit = async (goalId: string, amount: number | string, date = "2026-10-01", userId = alice.id) =>
  (await prisma.savingsDeposit.create({ data: { userId, goalId, amount, date: new Date(`${date}T00:00:00Z`) } })).id;

const balanceOf = async (goalId: string) =>
  (await prisma.savingsDeposit.aggregate({ where: { goalId }, _sum: { amount: true } }))._sum.amount?.toString() ?? "0";

beforeEach(async () => {
  alice = await createUser("alice");
  bob = await createUser("bob");
  await signInAs(alice);
});

afterEach(deleteTestUsers);
afterAll(() => prisma.$disconnect());

describe("getSavingsOverview", () => {
  it("is empty for a new user", async () => {
    expect(await getSavingsOverview()).toEqual({ goals: [], totalSaved: 0 });
  });

  it("lists goals by name with their balance and deposit history, newest first", async () => {
    const trip = await seedGoal("Trip", alice.id, 6000);
    const fund = await seedGoal("Emergency fund", alice.id, 20000);
    await seedDeposit(trip, 1000, "2026-09-01");
    await seedDeposit(trip, "250.50", "2026-10-05");
    await seedDeposit(trip, -100, "2026-10-20");
    await prisma.savingsGoal.update({ where: { id: trip }, data: { targetDate: new Date("2027-04-01T00:00:00Z") } });

    const { goals } = await getSavingsOverview();

    expect(goals.map((g) => g.name)).toEqual(["Emergency fund", "Trip"]);
    expect(goals[0]).toMatchObject({ id: fund, currentAmount: 0, deposits: [], targetDate: null });
    expect(goals[1]).toEqual({
      id: trip,
      name: "Trip",
      targetAmount: 6000,
      currency: "ILS",
      targetDate: "2027-04-01",
      currentAmount: 1150.5,
      deposits: [
        { id: expect.any(String), goalId: trip, amount: -100, date: "2026-10-20", note: null },
        { id: expect.any(String), goalId: trip, amount: 250.5, date: "2026-10-05", note: null },
        { id: expect.any(String), goalId: trip, amount: 1000, date: "2026-09-01", note: null },
      ],
    });
  });

  it("adds up exactly, to the cent, and totals every goal", async () => {
    const a = await seedGoal("A");
    const b = await seedGoal("B");
    await seedDeposit(a, "0.10");
    await seedDeposit(a, "0.20");
    await seedDeposit(b, "1000.05");
    await seedDeposit(b, "-0.05");

    const { goals, totalSaved } = await getSavingsOverview();

    expect(goals.map((g) => g.currentAmount)).toEqual([0.3, 1000]);
    expect(totalSaved).toBe(1000.3);
  });

  it("only returns the signed-in user's goals and deposits", async () => {
    const mine = await seedGoal("Mine");
    await seedDeposit(mine, 100);
    const bobs = await seedGoal("Bob's", bob.id);
    await seedDeposit(bobs, 999, "2026-10-01", bob.id);

    const overview = await getSavingsOverview();

    expect(overview.goals.map((g) => g.name)).toEqual(["Mine"]);
    expect(overview.totalSaved).toBe(100);
    await signInAs(bob);
    expect((await getSavingsOverview()).totalSaved).toBe(999);
  });

  it("sends signed-out callers to /login", async () => {
    signOut();

    await expect(getSavingsOverview()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });
});

describe("createGoal and updateGoal", () => {
  it("creates a goal owned by the signed-in user", async () => {
    const created = await createGoal(goalInput({ name: "Trip", targetAmount: 6000.5, targetDate: "2027-04-01" }));

    const [row] = await prisma.savingsGoal.findMany({ where: { userId: alice.id } });
    expect(row).toMatchObject({ id: created.id, name: "Trip", currency: "ILS" });
    expect(row.targetAmount.toString()).toBe("6000.5");
    expect(row.targetDate?.toISOString()).toBe("2027-04-01T00:00:00.000Z");
    expect(created).toEqual({
      id: row.id,
      name: "Trip",
      targetAmount: 6000.5,
      currency: "ILS",
      targetDate: "2027-04-01",
    });
    expect(await prisma.savingsGoal.count({ where: { userId: bob.id } })).toBe(0);
  });

  it("changes a goal and clears its target date", async () => {
    const id = await seedGoal("Trip");
    await prisma.savingsGoal.update({ where: { id }, data: { targetDate: new Date("2027-04-01T00:00:00Z") } });

    const updated = await updateGoal(id, goalInput({ name: "Japan", targetAmount: 7000, targetDate: null }));

    expect(updated).toMatchObject({ id, name: "Japan", targetAmount: 7000, targetDate: null });
  });

  it("keeps the deposits of a goal when it changes", async () => {
    const id = await seedGoal("Trip");
    await seedDeposit(id, 400);

    await updateGoal(id, goalInput({ name: "Japan" }));

    expect(await balanceOf(id)).toBe("400");
  });

  it("can't change another user's goal, even with its id", async () => {
    const bobs = await seedGoal("Bob's", bob.id);

    await expect(updateGoal(bobs, goalInput({ name: "Hijacked" }))).rejects.toMatchObject(appError("NOT_FOUND"));

    expect(await prisma.savingsGoal.findUniqueOrThrow({ where: { id: bobs } })).toMatchObject({ name: "Bob's" });
  });

  it("reports a goal that doesn't exist", async () => {
    await expect(updateGoal("missing", goalInput())).rejects.toMatchObject(appError("NOT_FOUND"));
  });

  it("sends signed-out callers to /login", async () => {
    signOut();

    await expect(createGoal(goalInput())).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
    expect(await prisma.savingsGoal.count()).toBe(0);
  });
});

describe("deleteGoal", () => {
  it("deletes a goal without deposits", async () => {
    const id = await seedGoal("Trip");

    await deleteGoal(id);

    expect(await prisma.savingsGoal.count({ where: { userId: alice.id } })).toBe(0);
  });

  it("refuses a goal that has deposits, saying how many, and keeps everything", async () => {
    const id = await seedGoal("Trip");
    await seedDeposit(id, 100);
    await seedDeposit(id, -20);

    await expect(deleteGoal(id)).rejects.toMatchObject({ ...appError("IN_USE"), details: { deposits: 2 } });

    expect(await prisma.savingsGoal.count({ where: { id } })).toBe(1);
    expect(await balanceOf(id)).toBe("80");
  });

  it("can delete the goal once its deposits are gone", async () => {
    const id = await seedGoal("Trip");
    const deposit = await seedDeposit(id, 100);

    await deleteDeposit(deposit);
    await deleteGoal(id);

    expect(await prisma.savingsGoal.count({ where: { id } })).toBe(0);
  });

  it("can't delete another user's goal", async () => {
    const bobs = await seedGoal("Bob's", bob.id);

    await expect(deleteGoal(bobs)).rejects.toMatchObject(appError("NOT_FOUND"));

    expect(await prisma.savingsGoal.count({ where: { id: bobs } })).toBe(1);
  });

  it("reports a goal that doesn't exist", async () => {
    await expect(deleteGoal("missing")).rejects.toMatchObject(appError("NOT_FOUND"));
  });
});

describe("addDeposit", () => {
  it("records a deposit owned by the signed-in user", async () => {
    const goal = await seedGoal("Trip");

    const created = await addDeposit(goal, entry(250.5, "2026-10-29", "Salary"));

    const [row] = await prisma.savingsDeposit.findMany({ where: { goalId: goal } });
    expect(row).toMatchObject({ id: created.id, userId: alice.id, note: "Salary" });
    expect(row.amount.toString()).toBe("250.5");
    expect(row.date.toISOString()).toBe("2026-10-29T00:00:00.000Z");
    expect(created).toEqual({ id: row.id, goalId: goal, amount: 250.5, date: "2026-10-29", note: "Salary" });
  });

  it("records a withdrawal as a negative amount", async () => {
    const goal = await seedGoal("Trip");
    await seedDeposit(goal, 500);

    await addDeposit(goal, entry(-200));

    expect(await balanceOf(goal)).toBe("300");
  });

  it("allows taking out everything, down to exactly zero", async () => {
    const goal = await seedGoal("Trip");
    await seedDeposit(goal, "100.10");

    await addDeposit(goal, entry(-100.1));

    expect(await balanceOf(goal)).toBe("0");
  });

  it("allows saving more than the target", async () => {
    const goal = await seedGoal("Trip", alice.id, 100);

    await addDeposit(goal, entry(250));

    expect((await getSavingsOverview()).goals[0].currentAmount).toBe(250);
  });

  it("refuses a withdrawal above the balance, saying where it would end up, and records nothing", async () => {
    const goal = await seedGoal("Trip");
    await seedDeposit(goal, 100);

    await expect(addDeposit(goal, entry(-100.01))).rejects.toMatchObject({
      ...appError("INVALID_REFERENCE"),
      field: "amount",
      message: expect.stringContaining("below zero"),
    });

    expect(await balanceOf(goal)).toBe("100");
    expect(await prisma.savingsDeposit.count({ where: { goalId: goal } })).toBe(1);
  });

  it("refuses any withdrawal from an empty goal", async () => {
    const goal = await seedGoal("Trip");

    await expect(addDeposit(goal, entry(-1))).rejects.toMatchObject(appError("INVALID_REFERENCE"));
  });

  it("never lets simultaneous withdrawals take a goal below zero", async () => {
    const goal = await seedGoal("Trip");
    await seedDeposit(goal, 100);

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => addDeposit(goal, entry(-30))),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await balanceOf(goal)).toBe("10");
  });

  it("can't add to another user's goal, even with its id", async () => {
    const bobs = await seedGoal("Bob's", bob.id);

    await expect(addDeposit(bobs, entry(100))).rejects.toMatchObject(appError("NOT_FOUND"));

    expect(await prisma.savingsDeposit.count()).toBe(0);
  });

  it("reports a goal that doesn't exist", async () => {
    await expect(addDeposit("missing", entry(100))).rejects.toMatchObject(appError("NOT_FOUND"));
  });

  it("sends signed-out callers to /login", async () => {
    const goal = await seedGoal("Trip");
    signOut();

    await expect(addDeposit(goal, entry(100))).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
    expect(await prisma.savingsDeposit.count()).toBe(0);
  });
});

describe("updateDeposit", () => {
  it("changes the amount, date and note, and returns it", async () => {
    const goal = await seedGoal("Trip");
    const id = await seedDeposit(goal, 100);

    const updated = await updateDeposit(id, entry(150.25, "2026-10-15", "Bonus"));

    expect(updated).toEqual({ id, goalId: goal, amount: 150.25, date: "2026-10-15", note: "Bonus" });
    expect(await prisma.savingsDeposit.count({ where: { goalId: goal } })).toBe(1);
  });

  it("can turn a deposit into a withdrawal when the goal can afford it", async () => {
    const goal = await seedGoal("Trip");
    const id = await seedDeposit(goal, 100);
    await seedDeposit(goal, 500);

    await updateDeposit(id, entry(-100));

    expect(await balanceOf(goal)).toBe("400");
  });

  it("refuses a change that would take the goal below zero, and keeps the deposit as it was", async () => {
    const goal = await seedGoal("Trip");
    const id = await seedDeposit(goal, 100);
    await seedDeposit(goal, -80);

    await expect(updateDeposit(id, entry(50))).rejects.toMatchObject({
      ...appError("INVALID_REFERENCE"),
      field: "amount",
    });

    expect(await balanceOf(goal)).toBe("20");
    expect((await prisma.savingsDeposit.findUniqueOrThrow({ where: { id } })).amount.toString()).toBe("100");
  });

  it("allows a change that leaves exactly zero", async () => {
    const goal = await seedGoal("Trip");
    const id = await seedDeposit(goal, 100);
    await seedDeposit(goal, -80);

    await updateDeposit(id, entry(80));

    expect(await balanceOf(goal)).toBe("0");
  });

  it("can't change another user's deposit, even with its id", async () => {
    const bobs = await seedGoal("Bob's", bob.id);
    const id = await seedDeposit(bobs, 100, "2026-10-01", bob.id);

    await expect(updateDeposit(id, entry(999))).rejects.toMatchObject(appError("NOT_FOUND"));

    expect(await balanceOf(bobs)).toBe("100");
  });

  it("reports a deposit that doesn't exist", async () => {
    await expect(updateDeposit("missing", entry(1))).rejects.toMatchObject(appError("NOT_FOUND"));
  });
});

describe("deleteDeposit", () => {
  it("deletes one's own deposit and only that one", async () => {
    const goal = await seedGoal("Trip");
    const id = await seedDeposit(goal, 100);
    await seedDeposit(goal, 50);

    await deleteDeposit(id);

    expect(await balanceOf(goal)).toBe("50");
  });

  it("can delete a withdrawal", async () => {
    const goal = await seedGoal("Trip");
    await seedDeposit(goal, 100);
    const id = await seedDeposit(goal, -30);

    await deleteDeposit(id);

    expect(await balanceOf(goal)).toBe("100");
  });

  it("refuses to delete a deposit that later withdrawals depend on", async () => {
    const goal = await seedGoal("Trip");
    const id = await seedDeposit(goal, 100);
    await seedDeposit(goal, -60);

    await expect(deleteDeposit(id)).rejects.toMatchObject(appError("INVALID_REFERENCE"));

    expect(await balanceOf(goal)).toBe("40");
    expect(await prisma.savingsDeposit.count({ where: { goalId: goal } })).toBe(2);
  });

  it("can't delete another user's deposit", async () => {
    const bobs = await seedGoal("Bob's", bob.id);
    const id = await seedDeposit(bobs, 100, "2026-10-01", bob.id);

    await expect(deleteDeposit(id)).rejects.toMatchObject(appError("NOT_FOUND"));

    expect(await prisma.savingsDeposit.count({ where: { id } })).toBe(1);
  });

  it("reports a deposit that doesn't exist, including one that was already deleted", async () => {
    const goal = await seedGoal("Trip");
    const id = await seedDeposit(goal, 100);
    await deleteDeposit(id);

    await expect(deleteDeposit(id)).rejects.toMatchObject(appError("NOT_FOUND"));
  });
});
