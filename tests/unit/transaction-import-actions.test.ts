import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data/transactions", () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  createTransactions: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { importTransactionsAction } from "@/actions/transactions";
import { createTransactions } from "@/lib/data/transactions";
import { AppError } from "@/lib/errors/app-error";
import { redirectError } from "../setup/redirect-error";

const row = (overrides: Record<string, unknown> = {}) => ({
  description: "Shop",
  amount: 12.5,
  date: "2026-10-31",
  categoryId: "cat-1",
  ...overrides,
});

const refreshedPaths = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path).sort();

beforeEach(() => vi.resetAllMocks());

describe("importTransactionsAction", () => {
  it("adds the rows, reports how many, and refreshes every page the new expenses show up on", async () => {
    vi.mocked(createTransactions).mockResolvedValue(2);

    const result = await importTransactionsAction([row(), row({ description: "Cafe", amount: "3.20" })]);

    expect(result).toEqual({ ok: true, count: 2 });
    expect(createTransactions).toHaveBeenCalledWith([
      { description: "Shop", amount: 12.5, date: "2026-10-31", categoryId: "cat-1" },
      { description: "Cafe", amount: 3.2, date: "2026-10-31", categoryId: "cat-1" },
    ]);
    expect(refreshedPaths()).toEqual(["/budget", "/dashboard", "/transactions"]);
  });

  it("never lets the client choose the owner, type, currency or id", async () => {
    vi.mocked(createTransactions).mockResolvedValue(1);

    await importTransactionsAction([row({ userId: "someone-else", type: "INCOME", currency: "USD", id: "chosen", note: "x" })]);

    expect(createTransactions).toHaveBeenCalledWith([
      { description: "Shop", amount: 12.5, date: "2026-10-31", categoryId: "cat-1" },
    ]);
  });

  it("rejects an empty list", async () => {
    expect(await importTransactionsAction([])).toEqual({
      ok: false,
      error: { code: "INVALID_INPUT", message: "There is nothing to import" },
    });
    expect(createTransactions).not.toHaveBeenCalled();
  });

  it("rejects more than 500 rows", async () => {
    const result = await importTransactionsAction(Array.from({ length: 501 }, () => row()));

    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_INPUT", message: "Import up to 500 transactions at a time" },
    });
    expect(createTransactions).not.toHaveBeenCalled();
  });

  it.each([
    ["a bad date", { date: "2026-02-30" }, "Row 2: Enter a valid date"],
    ["a zero amount", { amount: 0 }, "Row 2: Amount must be greater than zero"],
    ["no category", { categoryId: "" }, "Row 2: Choose a category"],
    ["a blank description", { description: " " }, "Row 2: Enter a description"],
  ])("says which row has %s, and imports nothing", async (_name, override, expected) => {
    const result = await importTransactionsAction([row(), row(override), row()]);

    expect(result).toEqual({ ok: false, error: { code: "INVALID_INPUT", message: expected } });
    expect(createTransactions).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "rows", 42, {}, [null], ["x"]])("rejects the non-rows %j", async (value) => {
    expect(await importTransactionsAction(value)).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
    expect(createTransactions).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("explains a category that can't be used, and refreshes nothing", async () => {
    vi.mocked(createTransactions).mockRejectedValue(
      AppError.invalidReference("Choose one of your expense categories for every row"),
    );

    expect(await importTransactionsAction([row()])).toEqual({
      ok: false,
      error: { code: "INVALID_REFERENCE", message: "Choose one of your expense categories for every row" },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("lets the redirect for signed-out users through, without logging it as an error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const redirect = redirectError();
    vi.mocked(createTransactions).mockRejectedValue(redirect);

    await expect(importTransactionsAction([row()])).rejects.toBe(redirect);

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logs anything unexpected once and rethrows it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("connection lost");
    vi.mocked(createTransactions).mockRejectedValue(failure);

    await expect(importTransactionsAction([row()])).rejects.toBe(failure);

    expect(consoleError).toHaveBeenCalledExactlyOnceWith("Unexpected error", failure);
  });
});
