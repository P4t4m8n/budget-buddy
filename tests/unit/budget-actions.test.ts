import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data/budgets", () => ({
  setBudget: vi.fn(),
  deleteBudget: vi.fn(),
  setGeneralBudget: vi.fn(),
  deleteGeneralBudget: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import {
  deleteBudgetAction,
  deleteGeneralBudgetAction,
  setBudgetAction,
  setGeneralBudgetAction,
} from "@/actions/budgets";
import {
  deleteBudget,
  deleteGeneralBudget,
  setBudget,
  setGeneralBudget,
} from "@/lib/data/budgets";
import { AppError } from "@/lib/errors/app-error";
import { redirectError } from "../setup/redirect-error";

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
};

const idle = { status: "idle" } as const;
const valid = { categoryId: "cat-1", month: "2026-10", limit: "2400" };

// The dashboard shows the month's budgets too, so every budget change refreshes both pages
const refreshedPaths = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path).sort();

beforeEach(() => vi.resetAllMocks());

describe("setBudgetAction", () => {
  it("sets the budget from cleaned-up input and refreshes the budget page and the dashboard", async () => {
    const result = await setBudgetAction(idle, form({ ...valid, limit: " 2400.50 " }));

    expect(result).toEqual({ status: "success" });
    expect(setBudget).toHaveBeenCalledWith({
      categoryId: "cat-1",
      month: "2026-10",
      limit: 2400.5,
      currency: "ILS",
    });
    expect(refreshedPaths()).toEqual(["/budget", "/dashboard"]);
  });

  it("never lets the client choose the owner, id or currency", async () => {
    await setBudgetAction(idle, form({ ...valid, userId: "someone-else", id: "chosen", currency: "USD" }));

    const [input] = vi.mocked(setBudget).mock.calls[0];
    expect(input).not.toHaveProperty("userId");
    expect(input).not.toHaveProperty("id");
    expect(input.currency).toBe("ILS");
  });

  it.each([
    ["a missing limit", { limit: "" }, { limit: "Enter an amount like 12.50" }],
    ["a zero limit", { limit: "0" }, { limit: "Amount must be greater than zero" }],
    ["too many decimals", { limit: "1.234" }, { limit: "Enter an amount like 12.50" }],
    ["a bad month", { month: "2026-13" }, { month: "Choose a valid month" }],
    ["no category", { categoryId: "" }, { categoryId: "Choose a category" }],
  ])("reports %s next to the field and saves nothing", async (_name, override, expected) => {
    const fields = { ...valid, ...override };

    const result = await setBudgetAction(idle, form(fields));

    expect(result).toEqual({ status: "error", fieldErrors: expected, values: fields });
    expect(setBudget).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("explains a category that can't be budgeted, on the category field", async () => {
    vi.mocked(setBudget).mockRejectedValue(
      AppError.invalidReference("Choose one of your expense categories", "categoryId"),
    );

    const result = await setBudgetAction(idle, form(valid));

    expect(result).toEqual({
      status: "error",
      errorCode: "INVALID_REFERENCE",
      fieldErrors: { categoryId: "Choose one of your expense categories" },
      values: valid,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("lets the redirect for signed-out users through, without logging it as an error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const redirect = redirectError();
    vi.mocked(setBudget).mockRejectedValue(redirect);

    await expect(setBudgetAction(idle, form(valid))).rejects.toBe(redirect);

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logs anything unexpected once and rethrows it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("connection lost");
    vi.mocked(setBudget).mockRejectedValue(failure);

    await expect(setBudgetAction(idle, form(valid))).rejects.toBe(failure);

    expect(consoleError).toHaveBeenCalledExactlyOnceWith("Unexpected error", failure);
  });
});

describe("deleteBudgetAction", () => {
  it("deletes and refreshes the budget page", async () => {
    expect(await deleteBudgetAction("b-1")).toEqual({ ok: true });
    expect(deleteBudget).toHaveBeenCalledWith("b-1");
    expect(refreshedPaths()).toEqual(["/budget", "/dashboard"]);
  });

  it("reports a budget that no longer exists, leaving the refresh to the dialog", async () => {
    vi.mocked(deleteBudget).mockRejectedValue(AppError.notFound("budget"));

    expect(await deleteBudgetAction("gone")).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: expect.stringContaining("budget no longer exists") },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 42, {}, ""])("rejects the id %j without touching the database", async (id) => {
    expect(await deleteBudgetAction(id as never)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(deleteBudget).not.toHaveBeenCalled();
  });

  it("rethrows unexpected errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(deleteBudget).mockRejectedValue(new Error("boom"));

    await expect(deleteBudgetAction("b-1")).rejects.toThrow("boom");
  });
});

describe("setGeneralBudgetAction", () => {
  const general = { month: "2026-10", limit: "4000" };

  it("sets the monthly budget from cleaned-up input and refreshes the budget page", async () => {
    const result = await setGeneralBudgetAction(idle, form({ ...general, limit: " 4000.50 " }));

    expect(result).toEqual({ status: "success" });
    expect(setGeneralBudget).toHaveBeenCalledWith({ month: "2026-10", limit: 4000.5, currency: "ILS" });
    expect(refreshedPaths()).toEqual(["/budget", "/dashboard"]);
  });

  it("never lets the client choose the owner, id, category or currency", async () => {
    await setGeneralBudgetAction(
      idle,
      form({ ...general, userId: "someone-else", id: "chosen", categoryId: "cat-1", currency: "USD" }),
    );

    const [input] = vi.mocked(setGeneralBudget).mock.calls[0];
    expect(input).toEqual({ month: "2026-10", limit: 4000, currency: "ILS" });
  });

  it.each([
    ["a missing limit", { limit: "" }, { limit: "Enter an amount like 12.50" }],
    ["a zero limit", { limit: "0" }, { limit: "Amount must be greater than zero" }],
    ["a bad month", { month: "2026-13" }, { month: "Choose a valid month" }],
  ])("reports %s next to the field and saves nothing", async (_name, override, expected) => {
    const fields = { ...general, ...override };

    const result = await setGeneralBudgetAction(idle, form(fields));

    expect(result).toEqual({ status: "error", fieldErrors: expected, values: fields });
    expect(setGeneralBudget).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("lets the redirect for signed-out users through, without logging it as an error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const redirect = redirectError();
    vi.mocked(setGeneralBudget).mockRejectedValue(redirect);

    await expect(setGeneralBudgetAction(idle, form(general))).rejects.toBe(redirect);

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logs anything unexpected once and rethrows it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("connection lost");
    vi.mocked(setGeneralBudget).mockRejectedValue(failure);

    await expect(setGeneralBudgetAction(idle, form(general))).rejects.toBe(failure);

    expect(consoleError).toHaveBeenCalledExactlyOnceWith("Unexpected error", failure);
  });
});

describe("deleteGeneralBudgetAction", () => {
  it("deletes and refreshes the budget page", async () => {
    expect(await deleteGeneralBudgetAction("m-1")).toEqual({ ok: true });
    expect(deleteGeneralBudget).toHaveBeenCalledWith("m-1");
    expect(refreshedPaths()).toEqual(["/budget", "/dashboard"]);
  });

  it("reports a monthly budget that no longer exists, leaving the refresh to the dialog", async () => {
    vi.mocked(deleteGeneralBudget).mockRejectedValue(AppError.notFound("monthly budget"));

    expect(await deleteGeneralBudgetAction("gone")).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: expect.stringContaining("monthly budget no longer exists") },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 42, {}, ""])("rejects the id %j without touching the database", async (id) => {
    expect(await deleteGeneralBudgetAction(id as never)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(deleteGeneralBudget).not.toHaveBeenCalled();
  });

  it("rethrows unexpected errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(deleteGeneralBudget).mockRejectedValue(new Error("boom"));

    await expect(deleteGeneralBudgetAction("m-1")).rejects.toThrow("boom");
  });
});
