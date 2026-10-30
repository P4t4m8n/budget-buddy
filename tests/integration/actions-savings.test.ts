import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import {
  addDepositAction,
  createGoalAction,
  deleteDepositAction,
  deleteGoalAction,
  updateDepositAction,
  updateGoalAction,
} from "@/actions/savings";
import { prisma } from "@/lib/prisma";
import { createUser, deleteTestUsers, signInAs, signOut } from "./support";

const idle = { status: "idle" } as const;

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
};

let alice: { id: string };
let bob: { id: string };

const goalForm = (overrides: Record<string, string> = {}) =>
  form({ name: "Emergency fund", targetAmount: "20000.50", targetDate: "2027-06-30", ...overrides });

const depositForm = (overrides: Record<string, string> = {}) =>
  form({ kind: "DEPOSIT", amount: "500.25", date: "2026-10-29", note: "Salary", ...overrides });

const seedGoal = async (userId: string, name = "Trip") =>
  (await prisma.savingsGoal.create({ data: { userId, name, targetAmount: 1000 } })).id;

const seedDeposit = async (userId: string, goalId: string, amount: number) =>
  (await prisma.savingsDeposit.create({ data: { userId, goalId, amount, date: new Date("2026-10-01T00:00:00Z") } })).id;

const balanceOf = async (goalId: string) =>
  (await prisma.savingsDeposit.aggregate({ where: { goalId }, _sum: { amount: true } }))._sum.amount?.toString() ?? "0";

const refreshedPaths = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path).sort();

beforeEach(async () => {
  vi.mocked(revalidatePath).mockClear();
  alice = await createUser("alice");
  bob = await createUser("bob");
  await signInAs(alice);
});

afterEach(deleteTestUsers);
afterAll(() => prisma.$disconnect());

// These call the Server Actions the way a browser would: anyone can POST to them,
// so each one has to be safe on its own
describe("savings Server Actions against the database", () => {
  it("creates a goal for the signed-in user with the exact target", async () => {
    expect(await createGoalAction(idle, goalForm())).toEqual({ status: "success" });

    const [row] = await prisma.savingsGoal.findMany({ where: { userId: alice.id } });
    expect(row).toMatchObject({ name: "Emergency fund", currency: "ILS" });
    expect(row.targetAmount.toString()).toBe("20000.5");
    expect(row.targetDate?.toISOString()).toBe("2027-06-30T00:00:00.000Z");
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/savings");
  });

  it("ignores a userId, id or currency in the form data", async () => {
    await createGoalAction(idle, goalForm({ userId: bob.id, id: "chosen-id", currency: "USD" }));

    expect(await prisma.savingsGoal.count({ where: { userId: bob.id } })).toBe(0);
    const [row] = await prisma.savingsGoal.findMany({ where: { userId: alice.id } });
    expect(row.id).not.toBe("chosen-id");
    expect(row.currency).toBe("ILS");
  });

  it("saves nothing when validation fails", async () => {
    const result = await createGoalAction(idle, goalForm({ name: "", targetAmount: "0" }));

    expect(result.status).toBe("error");
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["name", "targetAmount"]);
    expect(await prisma.savingsGoal.count()).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("updates one's own goal, and not another user's", async () => {
    const mine = await seedGoal(alice.id);
    const bobs = await seedGoal(bob.id, "Bob's");

    expect(await updateGoalAction(mine, idle, goalForm({ name: "Japan" }))).toEqual({ status: "success" });
    const hijack = await updateGoalAction(bobs, idle, goalForm({ name: "Hijacked" }));

    expect(await prisma.savingsGoal.findUniqueOrThrow({ where: { id: mine } })).toMatchObject({ name: "Japan" });
    expect(hijack).toMatchObject({ status: "error", errorCode: "NOT_FOUND" });
    expect(await prisma.savingsGoal.findUniqueOrThrow({ where: { id: bobs } })).toMatchObject({ name: "Bob's" });
  });

  it("deletes an empty goal, but not one with deposits", async () => {
    const empty = await seedGoal(alice.id, "Empty");
    const used = await seedGoal(alice.id, "Used");
    await seedDeposit(alice.id, used, 100);

    expect(await deleteGoalAction(empty)).toEqual({ ok: true });
    expect(await deleteGoalAction(used)).toMatchObject({
      ok: false,
      error: { code: "IN_USE", details: { deposits: 1 } },
    });

    expect(await prisma.savingsGoal.count({ where: { userId: alice.id } })).toBe(1);
    expect(await balanceOf(used)).toBe("100");
  });

  it("can't delete another user's goal, even with its id", async () => {
    const bobs = await seedGoal(bob.id);

    expect(await deleteGoalAction(bobs)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await prisma.savingsGoal.count({ where: { id: bobs } })).toBe(1);
  });

  it("adds a deposit with the exact amount, and refreshes the savings page and the dashboard", async () => {
    const goal = await seedGoal(alice.id);

    expect(await addDepositAction(goal, idle, depositForm())).toEqual({ status: "success" });

    const [row] = await prisma.savingsDeposit.findMany({ where: { goalId: goal } });
    expect(row).toMatchObject({ userId: alice.id, note: "Salary" });
    expect(row.amount.toString()).toBe("500.25");
    expect(refreshedPaths()).toEqual(["/dashboard", "/savings"]);
  });

  it("stores a withdrawal as a negative amount", async () => {
    const goal = await seedGoal(alice.id);
    await seedDeposit(alice.id, goal, 500);

    await addDepositAction(goal, idle, depositForm({ kind: "WITHDRAWAL", amount: "120.50" }));

    expect(await balanceOf(goal)).toBe("379.5");
  });

  it("refuses a withdrawal above the balance on the amount field, and records nothing", async () => {
    const goal = await seedGoal(alice.id);
    await seedDeposit(alice.id, goal, 100);

    const result = await addDepositAction(goal, idle, depositForm({ kind: "WITHDRAWAL", amount: "100.01" }));

    expect(result).toMatchObject({ status: "error", errorCode: "INVALID_REFERENCE" });
    expect(result.fieldErrors?.amount).toContain("below zero");
    expect(await balanceOf(goal)).toBe("100");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("ignores a userId or goalId in the deposit form: the goal is the bound one", async () => {
    const mine = await seedGoal(alice.id);
    const bobs = await seedGoal(bob.id, "Bob's");

    await addDepositAction(mine, idle, depositForm({ userId: bob.id, goalId: bobs }));

    expect(await prisma.savingsDeposit.count({ where: { goalId: bobs } })).toBe(0);
    expect(await prisma.savingsDeposit.count({ where: { goalId: mine, userId: alice.id } })).toBe(1);
  });

  it("can't add to another user's goal, even with its id", async () => {
    const bobs = await seedGoal(bob.id);

    expect(await addDepositAction(bobs, idle, depositForm())).toMatchObject({ status: "error", errorCode: "NOT_FOUND" });
    expect(await prisma.savingsDeposit.count()).toBe(0);
  });

  it("updates and deletes one's own deposit", async () => {
    const goal = await seedGoal(alice.id);
    const id = await seedDeposit(alice.id, goal, 100);

    expect(await updateDepositAction(id, idle, depositForm({ amount: "150" }))).toEqual({ status: "success" });
    expect(await balanceOf(goal)).toBe("150");
    expect(await deleteDepositAction(id)).toEqual({ ok: true });
    expect(await balanceOf(goal)).toBe("0");
  });

  it("refuses an update or delete that would take the goal below zero", async () => {
    const goal = await seedGoal(alice.id);
    const id = await seedDeposit(alice.id, goal, 100);
    await seedDeposit(alice.id, goal, -80);

    expect(await updateDepositAction(id, idle, depositForm({ amount: "50" }))).toMatchObject({
      status: "error",
      errorCode: "INVALID_REFERENCE",
    });
    expect(await deleteDepositAction(id)).toMatchObject({ ok: false, error: { code: "INVALID_REFERENCE" } });
    expect(await balanceOf(goal)).toBe("20");
  });

  it("can't update or delete another user's deposit, even with its id", async () => {
    const bobs = await seedGoal(bob.id);
    const id = await seedDeposit(bob.id, bobs, 100);

    expect(await updateDepositAction(id, idle, depositForm({ amount: "999" }))).toMatchObject({
      status: "error",
      errorCode: "NOT_FOUND",
    });
    expect(await deleteDepositAction(id)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await balanceOf(bobs)).toBe("100");
  });

  it("sends signed-out callers to /login instead of returning data", async () => {
    const goal = await seedGoal(alice.id);
    const deposit = await seedDeposit(alice.id, goal, 100);
    signOut();
    const toLogin = { digest: expect.stringContaining("/login") };

    await expect(createGoalAction(idle, goalForm())).rejects.toMatchObject(toLogin);
    await expect(updateGoalAction(goal, idle, goalForm())).rejects.toMatchObject(toLogin);
    await expect(deleteGoalAction(goal)).rejects.toMatchObject(toLogin);
    await expect(addDepositAction(goal, idle, depositForm())).rejects.toMatchObject(toLogin);
    await expect(updateDepositAction(deposit, idle, depositForm())).rejects.toMatchObject(toLogin);
    await expect(deleteDepositAction(deposit)).rejects.toMatchObject(toLogin);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await balanceOf(goal)).toBe("100");
  });
});
