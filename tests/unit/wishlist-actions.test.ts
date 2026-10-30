import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data/wishlist", () => ({
  createWishlistItem: vi.fn(),
  updateWishlistItem: vi.fn(),
  purchaseWishlistItem: vi.fn(),
  deleteWishlistItem: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import {
  createWishlistItemAction,
  deleteWishlistItemAction,
  purchaseWishlistItemAction,
  updateWishlistItemAction,
} from "@/actions/wishlist";
import {
  createWishlistItem,
  deleteWishlistItem,
  purchaseWishlistItem,
  updateWishlistItem,
} from "@/lib/data/wishlist";
import { AppError } from "@/lib/errors/app-error";
import { redirectError } from "../setup/redirect-error";

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
};

const idle = { status: "idle" } as const;
const valid = {
  name: "Standing desk",
  price: "620",
  priority: "HIGH",
  status: "WANTED",
  url: "",
  notes: "",
};
const purchase = { categoryId: "cat-1", date: "2026-10-29" };

beforeEach(() => vi.resetAllMocks());

describe("createWishlistItemAction", () => {
  it("creates the item from cleaned-up input and refreshes only the wishlist", async () => {
    const result = await createWishlistItemAction(
      idle,
      form({ ...valid, name: "  Standing desk ", price: " 620.50 ", url: "https://example.com/desk" }),
    );

    expect(result).toEqual({ status: "success" });
    expect(createWishlistItem).toHaveBeenCalledWith({
      name: "Standing desk",
      price: 620.5,
      currency: "ILS",
      priority: "HIGH",
      status: "WANTED",
      url: "https://example.com/desk",
      notes: null,
    });
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/wishlist");
  });

  it("never lets the client choose the owner, id or currency", async () => {
    await createWishlistItemAction(
      idle,
      form({ ...valid, userId: "someone-else", id: "chosen", currency: "USD" }),
    );

    const [input] = vi.mocked(createWishlistItem).mock.calls[0];
    expect(input).not.toHaveProperty("userId");
    expect(input).not.toHaveProperty("id");
    expect(input.currency).toBe("ILS");
  });

  it.each([
    ["no name", { name: "" }, { name: "Enter a name" }],
    ["a zero price", { price: "0" }, { price: "Amount must be greater than zero" }],
    ["too many decimals", { price: "1.234" }, { price: "Enter an amount like 12.50" }],
    ["a javascript: link", { url: "javascript:alert(1)" }, { url: "Enter a link starting with http:// or https://" }],
  ])("reports %s next to the field and saves nothing", async (_name, override, expected) => {
    const fields = { ...valid, ...override };

    const result = await createWishlistItemAction(idle, form(fields));

    expect(result).toEqual({ status: "error", fieldErrors: expected, values: fields });
    expect(createWishlistItem).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("can't be used to create an already purchased item", async () => {
    const result = await createWishlistItemAction(idle, form({ ...valid, status: "PURCHASED" }));

    expect(result.fieldErrors).toHaveProperty("status");
    expect(createWishlistItem).not.toHaveBeenCalled();
  });

  it("lets the redirect for signed-out users through, without logging it as an error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const redirect = redirectError();
    vi.mocked(createWishlistItem).mockRejectedValue(redirect);

    await expect(createWishlistItemAction(idle, form(valid))).rejects.toBe(redirect);

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logs anything unexpected once and rethrows it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("connection lost");
    vi.mocked(createWishlistItem).mockRejectedValue(failure);

    await expect(createWishlistItemAction(idle, form(valid))).rejects.toBe(failure);

    expect(consoleError).toHaveBeenCalledExactlyOnceWith("Unexpected error", failure);
  });
});

describe("updateWishlistItemAction", () => {
  it("updates the bound item and refreshes the wishlist", async () => {
    const result = await updateWishlistItemAction("w-1", idle, form({ ...valid, status: "SAVING" }));

    expect(result).toEqual({ status: "success" });
    expect(updateWishlistItem).toHaveBeenCalledWith("w-1", expect.objectContaining({ status: "SAVING" }));
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/wishlist");
  });

  it("reports an item that no longer exists, leaving the refresh to the dialog", async () => {
    vi.mocked(updateWishlistItem).mockRejectedValue(AppError.notFound("wishlist item"));

    const result = await updateWishlistItemAction("gone", idle, form(valid));

    expect(result).toMatchObject({ status: "error", errorCode: "NOT_FOUND", values: valid });
    expect(result.message).toContain("wishlist item no longer exists");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports validation errors without saving", async () => {
    const result = await updateWishlistItemAction("w-1", idle, form({ ...valid, name: "" }));

    expect(result.fieldErrors).toEqual({ name: "Enter a name" });
    expect(updateWishlistItem).not.toHaveBeenCalled();
  });
});

describe("purchaseWishlistItemAction", () => {
  it("purchases the bound item and refreshes every page that shows the new expense", async () => {
    const result = await purchaseWishlistItemAction("w-1", idle, form(purchase));

    expect(result).toEqual({ status: "success" });
    expect(purchaseWishlistItem).toHaveBeenCalledWith("w-1", purchase);
    expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path).sort()).toEqual([
      "/budget",
      "/dashboard",
      "/transactions",
      "/wishlist",
    ]);
  });

  it.each([
    ["no category", { categoryId: "" }, { categoryId: "Choose a category" }],
    ["a bad date", { date: "2026-13-01" }, { date: "Enter a valid date" }],
  ])("reports %s next to the field and records nothing", async (_name, override, expected) => {
    const fields = { ...purchase, ...override };

    const result = await purchaseWishlistItemAction("w-1", idle, form(fields));

    expect(result).toEqual({ status: "error", fieldErrors: expected, values: fields });
    expect(purchaseWishlistItem).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["an item bought in another tab", AppError.duplicate("This item is already marked as purchased"), "DUPLICATE"],
    ["a deleted item", AppError.notFound("wishlist item"), "NOT_FOUND"],
    [
      "a category that can't be used",
      AppError.invalidReference("Choose one of your expense categories", "categoryId"),
      "INVALID_REFERENCE",
    ],
  ])("reports %s, leaving the refresh to the dialog", async (_name, error, code) => {
    vi.mocked(purchaseWishlistItem).mockRejectedValue(error);

    const result = await purchaseWishlistItemAction("w-1", idle, form(purchase));

    expect(result).toMatchObject({ status: "error", errorCode: code, values: purchase });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteWishlistItemAction", () => {
  it("deletes and refreshes the wishlist", async () => {
    expect(await deleteWishlistItemAction("w-1")).toEqual({ ok: true });
    expect(deleteWishlistItem).toHaveBeenCalledWith("w-1");
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/wishlist");
  });

  it("reports an item that no longer exists, leaving the refresh to the dialog", async () => {
    vi.mocked(deleteWishlistItem).mockRejectedValue(AppError.notFound("wishlist item"));

    expect(await deleteWishlistItemAction("gone")).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: expect.stringContaining("wishlist item no longer exists") },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 42, {}, ""])("rejects the id %j without touching the database", async (id) => {
    expect(await deleteWishlistItemAction(id as never)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(deleteWishlistItem).not.toHaveBeenCalled();
  });

  it("rethrows unexpected errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(deleteWishlistItem).mockRejectedValue(new Error("boom"));

    await expect(deleteWishlistItemAction("w-1")).rejects.toThrow("boom");
  });
});
