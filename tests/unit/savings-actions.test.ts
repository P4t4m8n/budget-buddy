import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data/savings", () => ({
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  addDeposit: vi.fn(),
  updateDeposit: vi.fn(),
  deleteDeposit: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import {
  addDepositAction,
  createGoalAction,
  deleteDepositAction,
  deleteGoalAction,
  updateDepositAction,
  updateGoalAction,
} from "@/actions/savings";
import {
  addDeposit,
  createGoal,
  deleteDeposit,
  deleteGoal,
  updateDeposit,
  updateGoal,
} from "@/lib/data/savings";
import { AppError } from "@/lib/errors/app-error";
import { redirectError } from "../setup/redirect-error";

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
};

const idle = { status: "idle" } as const;
const goal = { name: "Emergency fund", targetAmount: "20000", targetDate: "" };
const deposit = { kind: "DEPOSIT", amount: "500", date: "2026-10-29", note: "" };

const refreshedPaths = () =>
  vi.mocked(revalidatePath).mock.calls.map(([path]) => path).sort();

beforeEach(() => vi.resetAllMocks());

describe("createGoalAction", () => {
  it("creates the goal from cleaned-up input and refreshes the savings page", async () => {
    const result = await createGoalAction(
      idle,
      form({ ...goal, name: "  Emergency fund ", targetAmount: " 20000.50 ", targetDate: "2027-06-30" }),
    );

    expect(result).toEqual({ status: "success" });
    expect(createGoal).toHaveBeenCalledWith({
      name: "Emergency fund",
      targetAmount: 20000.5,
      currency: "ILS",
      targetDate: "2027-06-30",
    });
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/savings");
  });

  it("never lets the client choose the owner, id or currency", async () => {
    await createGoalAction(idle, form({ ...goal, userId: "someone-else", id: "chosen", currency: "USD" }));

    const [input] = vi.mocked(createGoal).mock.calls[0];
    expect(input).not.toHaveProperty("userId");
    expect(input).not.toHaveProperty("id");
    expect(input.currency).toBe("ILS");
  });

  it.each([
    ["no name", { name: "" }, { name: "Enter a name" }],
    ["a zero target", { targetAmount: "0" }, { targetAmount: "Amount must be greater than zero" }],
    ["a bad date", { targetDate: "2027-13-01" }, { targetDate: "Enter a valid date" }],
  ])("reports %s next to the field and saves nothing", async (_name, override, expected) => {
    const fields = { ...goal, ...override };

    const result = await createGoalAction(idle, form(fields));

    expect(result).toEqual({ status: "error", fieldErrors: expected, values: fields });
    expect(createGoal).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("lets the redirect for signed-out users through, without logging it as an error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const redirect = redirectError();
    vi.mocked(createGoal).mockRejectedValue(redirect);

    await expect(createGoalAction(idle, form(goal))).rejects.toBe(redirect);

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logs anything unexpected once and rethrows it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("connection lost");
    vi.mocked(createGoal).mockRejectedValue(failure);

    await expect(createGoalAction(idle, form(goal))).rejects.toBe(failure);

    expect(consoleError).toHaveBeenCalledExactlyOnceWith("Unexpected error", failure);
  });
});

describe("updateGoalAction", () => {
  it("updates the bound goal and refreshes the savings page", async () => {
    expect(await updateGoalAction("g-1", idle, form(goal))).toEqual({ status: "success" });

    expect(updateGoal).toHaveBeenCalledWith("g-1", expect.objectContaining({ name: "Emergency fund" }));
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/savings");
  });

  it("reports a goal that no longer exists, leaving the refresh to the dialog", async () => {
    vi.mocked(updateGoal).mockRejectedValue(AppError.notFound("savings goal"));

    const result = await updateGoalAction("gone", idle, form(goal));

    expect(result).toMatchObject({ status: "error", errorCode: "NOT_FOUND", values: goal });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteGoalAction", () => {
  it("deletes and refreshes the savings page", async () => {
    expect(await deleteGoalAction("g-1")).toEqual({ ok: true });
    expect(deleteGoal).toHaveBeenCalledWith("g-1");
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/savings");
  });

  it("passes on how many deposits are in the way", async () => {
    vi.mocked(deleteGoal).mockRejectedValue(AppError.inUse("This goal still has deposits.", { deposits: 3 }));

    expect(await deleteGoalAction("g-1")).toEqual({
      ok: false,
      error: { code: "IN_USE", message: "This goal still has deposits.", details: { deposits: 3 } },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 42, {}, ""])("rejects the id %j without touching the database", async (id) => {
    expect(await deleteGoalAction(id as never)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(deleteGoal).not.toHaveBeenCalled();
  });
});

describe("addDepositAction", () => {
  it("adds a deposit to the bound goal and refreshes the savings page and the dashboard", async () => {
    const result = await addDepositAction("g-1", idle, form({ ...deposit, note: " Salary " }));

    expect(result).toEqual({ status: "success" });
    expect(addDeposit).toHaveBeenCalledWith("g-1", { amount: 500, date: "2026-10-29", note: "Salary" });
    expect(refreshedPaths()).toEqual(["/dashboard", "/savings"]);
  });

  it("turns a withdrawal into a negative amount", async () => {
    await addDepositAction("g-1", idle, form({ ...deposit, kind: "WITHDRAWAL", amount: "120.50" }));

    expect(addDeposit).toHaveBeenCalledWith("g-1", expect.objectContaining({ amount: -120.5 }));
  });

  it("never lets the client choose the owner, goal or id through the form", async () => {
    await addDepositAction("g-1", idle, form({ ...deposit, userId: "someone-else", goalId: "g-2", id: "chosen" }));

    expect(addDeposit).toHaveBeenCalledWith("g-1", expect.not.objectContaining({ userId: expect.anything() }));
    const [goalId, input] = vi.mocked(addDeposit).mock.calls[0];
    expect(goalId).toBe("g-1");
    expect(input).not.toHaveProperty("goalId");
    expect(input).not.toHaveProperty("id");
  });

  it.each([
    ["no amount", { amount: "" }, { amount: "Enter an amount like 12.50" }],
    ["a negative amount", { amount: "-5" }, { amount: "Enter an amount like 12.50" }],
    ["a bad date", { date: "2026-13-01" }, { date: "Enter a valid date" }],
  ])("reports %s next to the field and saves nothing", async (_name, override, expected) => {
    const fields = { ...deposit, ...override };

    const result = await addDepositAction("g-1", idle, form(fields));

    expect(result).toEqual({ status: "error", fieldErrors: expected, values: fields });
    expect(addDeposit).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("explains a withdrawal that would go below zero, on the amount field", async () => {
    vi.mocked(addDeposit).mockRejectedValue(
      AppError.invalidReference("This would take the goal below zero", "amount"),
    );

    const result = await addDepositAction("g-1", idle, form({ ...deposit, kind: "WITHDRAWAL" }));

    expect(result).toEqual({
      status: "error",
      errorCode: "INVALID_REFERENCE",
      fieldErrors: { amount: "This would take the goal below zero" },
      values: { ...deposit, kind: "WITHDRAWAL" },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a goal that no longer exists", async () => {
    vi.mocked(addDeposit).mockRejectedValue(AppError.notFound("savings goal"));

    expect(await addDepositAction("gone", idle, form(deposit))).toMatchObject({
      status: "error",
      errorCode: "NOT_FOUND",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateDepositAction", () => {
  it("updates the bound deposit and refreshes the savings page and the dashboard", async () => {
    expect(await updateDepositAction("d-1", idle, form({ ...deposit, kind: "WITHDRAWAL" }))).toEqual({
      status: "success",
    });

    expect(updateDeposit).toHaveBeenCalledWith("d-1", { amount: -500, date: "2026-10-29", note: null });
    expect(refreshedPaths()).toEqual(["/dashboard", "/savings"]);
  });

  it("reports validation errors without saving", async () => {
    const result = await updateDepositAction("d-1", idle, form({ ...deposit, amount: "0" }));

    expect(result.fieldErrors).toEqual({ amount: "Amount must be greater than zero" });
    expect(updateDeposit).not.toHaveBeenCalled();
  });
});

describe("deleteDepositAction", () => {
  it("deletes and refreshes the savings page and the dashboard", async () => {
    expect(await deleteDepositAction("d-1")).toEqual({ ok: true });
    expect(deleteDeposit).toHaveBeenCalledWith("d-1");
    expect(refreshedPaths()).toEqual(["/dashboard", "/savings"]);
  });

  it("explains a delete that would take the goal below zero", async () => {
    vi.mocked(deleteDeposit).mockRejectedValue(
      AppError.invalidReference("This would take the goal below zero", "amount"),
    );

    expect(await deleteDepositAction("d-1")).toEqual({
      ok: false,
      error: { code: "INVALID_REFERENCE", message: "This would take the goal below zero" },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 42, {}, ""])("rejects the id %j without touching the database", async (id) => {
    expect(await deleteDepositAction(id as never)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(deleteDeposit).not.toHaveBeenCalled();
  });

  it("rethrows unexpected errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(deleteDeposit).mockRejectedValue(new Error("boom"));

    await expect(deleteDepositAction("d-1")).rejects.toThrow("boom");
  });
});
