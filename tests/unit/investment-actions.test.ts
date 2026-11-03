import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data/investments", () => ({
  createInvestment: vi.fn(),
  updateInvestment: vi.fn(),
  updateInvestmentValue: vi.fn(),
  deleteInvestment: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import {
  createInvestmentAction,
  deleteInvestmentAction,
  updateInvestmentAction,
  updateInvestmentValueAction,
} from "@/actions/investments";
import {
  createInvestment,
  deleteInvestment,
  updateInvestment,
  updateInvestmentValue,
} from "@/lib/data/investments";
import { AppError } from "@/lib/errors/app-error";
import { redirectError } from "../setup/redirect-error";

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
};

const idle = { status: "idle" } as const;
const valid = {
  name: "S&P 500 ETF",
  type: "ETF",
  ticker: "",
  amountInvested: "8000",
  currentValue: "9150.50",
  purchaseDate: "2025-03-10",
};

beforeEach(() => vi.resetAllMocks());

describe("createInvestmentAction", () => {
  it("creates the investment from cleaned-up input and refreshes the savings page", async () => {
    const result = await createInvestmentAction(
      idle,
      form({ ...valid, name: "  S&P 500 ETF ", ticker: " voo ", amountInvested: " 8000.50 " }),
    );

    expect(result).toEqual({ status: "success" });
    expect(createInvestment).toHaveBeenCalledWith({
      name: "S&P 500 ETF",
      type: "ETF",
      ticker: "VOO",
      amountInvested: 8000.5,
      currentValue: 9150.5,
      currency: "ILS",
      purchaseDate: "2025-03-10",
    });
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/savings");
  });

  it("accepts a current value of zero", async () => {
    const result = await createInvestmentAction(idle, form({ ...valid, currentValue: "0" }));

    expect(result).toEqual({ status: "success" });
    expect(createInvestment).toHaveBeenCalledWith(expect.objectContaining({ currentValue: 0 }));
  });

  it("never lets the client choose the owner, id or currency", async () => {
    await createInvestmentAction(idle, form({ ...valid, userId: "someone-else", id: "chosen", currency: "USD" }));

    const [input] = vi.mocked(createInvestment).mock.calls[0];
    expect(input).not.toHaveProperty("userId");
    expect(input).not.toHaveProperty("id");
    expect(input.currency).toBe("ILS");
  });

  it.each([
    ["no name", { name: "" }, { name: "Enter a name" }],
    ["a zero amount invested", { amountInvested: "0" }, { amountInvested: "Amount must be greater than zero" }],
    ["a negative current value", { currentValue: "-1" }, { currentValue: "Enter an amount like 12.50" }],
    ["no purchase date", { purchaseDate: "" }, { purchaseDate: "Enter a valid date" }],
  ])("reports %s next to the field and saves nothing", async (_name, override, expected) => {
    const fields = { ...valid, ...override };

    const result = await createInvestmentAction(idle, form(fields));

    expect(result).toEqual({ status: "error", fieldErrors: expected, values: fields });
    expect(createInvestment).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("lets the redirect for signed-out users through, without logging it as an error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const redirect = redirectError();
    vi.mocked(createInvestment).mockRejectedValue(redirect);

    await expect(createInvestmentAction(idle, form(valid))).rejects.toBe(redirect);

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logs anything unexpected once and rethrows it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("connection lost");
    vi.mocked(createInvestment).mockRejectedValue(failure);

    await expect(createInvestmentAction(idle, form(valid))).rejects.toBe(failure);

    expect(consoleError).toHaveBeenCalledExactlyOnceWith("Unexpected error", failure);
  });
});

describe("updateInvestmentAction", () => {
  it("updates the bound investment without a current value", async () => {
    const result = await updateInvestmentAction("i-1", idle, form({ ...valid, currentValue: "1" }));

    expect(result).toEqual({ status: "success" });
    expect(updateInvestment).toHaveBeenCalledWith("i-1", {
      name: "S&P 500 ETF",
      type: "ETF",
      ticker: null,
      amountInvested: 8000,
      currency: "ILS",
      purchaseDate: "2025-03-10",
    });
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/savings");
  });

  it("works with the form the edit dialog sends, which has no current value", async () => {
    const editForm = form({
      name: valid.name,
      type: valid.type,
      ticker: valid.ticker,
      amountInvested: valid.amountInvested,
      purchaseDate: valid.purchaseDate,
    });

    expect(await updateInvestmentAction("i-1", idle, editForm)).toEqual({ status: "success" });
  });

  it("reports an investment that no longer exists, leaving the refresh to the dialog", async () => {
    vi.mocked(updateInvestment).mockRejectedValue(AppError.notFound("investment"));

    const result = await updateInvestmentAction("gone", idle, form(valid));

    expect(result).toMatchObject({ status: "error", errorCode: "NOT_FOUND" });
    expect(result.message).toContain("investment no longer exists");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports validation errors without saving", async () => {
    const result = await updateInvestmentAction("i-1", idle, form({ ...valid, name: "" }));

    expect(result.fieldErrors).toEqual({ name: "Enter a name" });
    expect(updateInvestment).not.toHaveBeenCalled();
  });
});

describe("updateInvestmentValueAction", () => {
  it("sets the value of the bound investment and refreshes the savings page", async () => {
    const result = await updateInvestmentValueAction("i-1", idle, form({ value: " 9500.25 " }));

    expect(result).toEqual({ status: "success" });
    expect(updateInvestmentValue).toHaveBeenCalledWith("i-1", { value: 9500.25 });
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/savings");
  });

  it("accepts zero", async () => {
    await updateInvestmentValueAction("i-1", idle, form({ value: "0" }));

    expect(updateInvestmentValue).toHaveBeenCalledWith("i-1", { value: 0 });
  });

  it("never lets the client choose the date, owner or investment through the form", async () => {
    await updateInvestmentValueAction(
      "i-1",
      idle,
      form({ value: "10", date: "2020-01-01", userId: "someone-else", investmentId: "i-2" }),
    );

    expect(updateInvestmentValue).toHaveBeenCalledExactlyOnceWith("i-1", { value: 10 });
  });

  it.each(["", "-5", "abc", "1.234"])("rejects the value %j next to the field", async (value) => {
    const result = await updateInvestmentValueAction("i-1", idle, form({ value }));

    expect(result).toEqual({
      status: "error",
      fieldErrors: { value: "Enter an amount like 12.50" },
      values: { value },
    });
    expect(updateInvestmentValue).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports an investment that no longer exists", async () => {
    vi.mocked(updateInvestmentValue).mockRejectedValue(AppError.notFound("investment"));

    expect(await updateInvestmentValueAction("gone", idle, form({ value: "5" }))).toMatchObject({
      status: "error",
      errorCode: "NOT_FOUND",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteInvestmentAction", () => {
  it("deletes and refreshes the savings page", async () => {
    expect(await deleteInvestmentAction("i-1")).toEqual({ ok: true });
    expect(deleteInvestment).toHaveBeenCalledWith("i-1");
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/savings");
  });

  it("reports an investment that no longer exists, leaving the refresh to the dialog", async () => {
    vi.mocked(deleteInvestment).mockRejectedValue(AppError.notFound("investment"));

    expect(await deleteInvestmentAction("gone")).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: expect.stringContaining("investment no longer exists") },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 42, {}, ""])("rejects the id %j without touching the database", async (id) => {
    expect(await deleteInvestmentAction(id as never)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(deleteInvestment).not.toHaveBeenCalled();
  });

  it("rethrows unexpected errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(deleteInvestment).mockRejectedValue(new Error("boom"));

    await expect(deleteInvestmentAction("i-1")).rejects.toThrow("boom");
  });
});
