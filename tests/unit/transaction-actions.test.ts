import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data/transactions", () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import {
  createTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
} from "@/actions/transactions";
import { CategoryMismatchError, NotFoundError } from "@/lib/data/errors";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/lib/data/transactions";

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
};

const idle = { status: "idle" } as const;
const valid = {
  description: "Supermarket",
  amount: "123.45",
  type: "EXPENSE",
  categoryId: "cat-1",
  date: "2026-10-29",
  note: "",
};

beforeEach(() => vi.resetAllMocks());

describe("createTransactionAction", () => {
  it("creates the transaction from cleaned-up input and refreshes the list", async () => {
    const result = await createTransactionAction(
      idle,
      form({ ...valid, description: "  Supermarket ", note: "  weekly shop " }),
    );

    expect(result).toEqual({ status: "success" });
    expect(createTransaction).toHaveBeenCalledWith({
      description: "Supermarket",
      amount: 123.45,
      currency: "ILS",
      type: "EXPENSE",
      categoryId: "cat-1",
      date: "2026-10-29",
      note: "weekly shop",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/transactions");
  });

  it("stores a blank note as null", async () => {
    await createTransactionAction(idle, form({ ...valid, note: "   " }));

    expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
  });

  it("never lets the client choose the owner, id or currency", async () => {
    await createTransactionAction(
      idle,
      form({ ...valid, userId: "someone-else", id: "chosen", currency: "USD" }),
    );

    const [input] = vi.mocked(createTransaction).mock.calls[0];
    expect(input).not.toHaveProperty("userId");
    expect(input).not.toHaveProperty("id");
  });

  it.each([
    ["a blank description", { description: "  " }, { description: "Enter a description" }],
    ["a zero amount", { amount: "0" }, { amount: "Amount must be greater than zero" }],
    ["too many decimals", { amount: "1.234" }, { amount: "Enter an amount like 12.50" }],
    ["text as the amount", { amount: "abc" }, { amount: "Enter an amount like 12.50" }],
    ["a missing category", { categoryId: "" }, { categoryId: "Choose a category" }],
    ["an impossible date", { date: "2026-02-30" }, { date: "Enter a valid date" }],
    ["an unknown type", { type: "TRANSFER" }, { type: expect.any(String) }],
  ])("reports %s next to the field and saves nothing", async (_name, override, expected) => {
    const fields = { ...valid, ...override };

    const result = await createTransactionAction(idle, form(fields));

    expect(result).toEqual({ status: "error", fieldErrors: expected, values: fields });
    expect(createTransaction).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports several problems at once and returns what the user typed", async () => {
    const fields = { ...valid, description: "", amount: "-5", date: "" };

    const result = await createTransactionAction(idle, form(fields));

    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["amount", "date", "description"]);
    expect(result.values).toEqual(fields);
  });

  it("explains a category that doesn't fit, on the category field", async () => {
    vi.mocked(createTransaction).mockRejectedValue(new CategoryMismatchError());

    const result = await createTransactionAction(idle, form(valid));

    expect(result).toEqual({
      status: "error",
      fieldErrors: { categoryId: "Choose one of your categories that matches the transaction type" },
      values: valid,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rethrows anything unexpected, such as the redirect for signed-out users", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login" });
    vi.mocked(createTransaction).mockRejectedValue(redirect);

    await expect(createTransactionAction(idle, form(valid))).rejects.toBe(redirect);

    vi.mocked(createTransaction).mockRejectedValue(new Error("connection lost"));
    await expect(createTransactionAction(idle, form(valid))).rejects.toThrow("connection lost");
  });
});

describe("updateTransactionAction", () => {
  it("updates the bound transaction and refreshes the list", async () => {
    const result = await updateTransactionAction("tx-1", idle, form(valid));

    expect(result).toEqual({ status: "success" });
    expect(updateTransaction).toHaveBeenCalledWith("tx-1", expect.objectContaining({ amount: 123.45 }));
    expect(revalidatePath).toHaveBeenCalledWith("/transactions");
  });

  it("validates before touching the database", async () => {
    const result = await updateTransactionAction("tx-1", idle, form({ ...valid, amount: "0" }));

    expect(result.fieldErrors?.amount).toBeDefined();
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  it("explains a category that doesn't fit", async () => {
    vi.mocked(updateTransaction).mockRejectedValue(new CategoryMismatchError());

    const result = await updateTransactionAction("tx-1", idle, form(valid));

    expect(result.fieldErrors?.categoryId).toContain("matches the transaction type");
  });

  it("explains a transaction that vanished, leaving the refresh to the dialog", async () => {
    vi.mocked(updateTransaction).mockRejectedValue(new NotFoundError("Transaction"));

    const result = await updateTransactionAction("gone", idle, form(valid));

    expect(result.status).toBe("error");
    expect(result.message).toContain("no longer exists");
    // Refreshing now would remove the row and the open dialog before the message is read
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rethrows unexpected errors", async () => {
    vi.mocked(updateTransaction).mockRejectedValue(new Error("boom"));

    await expect(updateTransactionAction("tx-1", idle, form(valid))).rejects.toThrow("boom");
  });
});

describe("deleteTransactionAction", () => {
  it("deletes and refreshes the list", async () => {
    expect(await deleteTransactionAction("tx-1")).toEqual({ ok: true });
    expect(deleteTransaction).toHaveBeenCalledWith("tx-1");
    expect(revalidatePath).toHaveBeenCalledWith("/transactions");
  });

  it("reports a transaction that no longer exists", async () => {
    vi.mocked(deleteTransaction).mockRejectedValue(new NotFoundError("Transaction"));

    expect(await deleteTransactionAction("gone")).toEqual({ ok: false, reason: "not_found" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 42, {}, ""])("rejects the id %j without touching the database", async (id) => {
    expect(await deleteTransactionAction(id as never)).toEqual({ ok: false, reason: "not_found" });
    expect(deleteTransaction).not.toHaveBeenCalled();
  });

  it("rethrows unexpected errors", async () => {
    vi.mocked(deleteTransaction).mockRejectedValue(new Error("boom"));

    await expect(deleteTransactionAction("tx-1")).rejects.toThrow("boom");
  });
});
