import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data/categories", () => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/actions/categories";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/data/categories";
import { AppError } from "@/lib/errors/app-error";
import { redirectError } from "../setup/redirect-error";

const duplicate = () =>
  AppError.duplicate("You already have a category with this name and type", "name");

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
};

const idle = { status: "idle" } as const;
const valid = { name: "Groceries", type: "EXPENSE", color: "#F59E0B" };

beforeEach(() => vi.resetAllMocks());

describe("createCategoryAction", () => {
  it("creates the category from cleaned-up input and refreshes the pages that show it", async () => {
    const result = await createCategoryAction(idle, form({ ...valid, name: "  Groceries " }));

    expect(result).toEqual({ status: "success" });
    expect(createCategory).toHaveBeenCalledWith({
      name: "Groceries",
      type: "EXPENSE",
      color: "#f59e0b",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/categories");
    // Categories appear on the transactions page too (names, filter and form), and on the dashboard
    expect(revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("never lets the client choose the owner", async () => {
    await createCategoryAction(idle, form({ ...valid, userId: "someone-else", id: "chosen" }));

    expect(createCategory).toHaveBeenCalledWith({
      name: "Groceries",
      type: "EXPENSE",
      color: "#f59e0b",
    });
  });

  it.each([
    ["a blank name", { name: "   " }, { name: "Enter a name" }],
    ["a name that is too long", { name: "x".repeat(41) }, { name: "Keep the name under 40 characters" }],
    ["a bad color", { color: "red" }, { color: "Pick a valid color" }],
    ["a missing type", { type: "" }, { type: expect.any(String) }],
  ])("reports %s next to the field and saves nothing", async (_name, override, expected) => {
    const fields = { ...valid, ...override };

    const result = await createCategoryAction(idle, form(fields));

    expect(result).toEqual({ status: "error", fieldErrors: expected, values: fields });
    expect(createCategory).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports several problems at once", async () => {
    const result = await createCategoryAction(idle, form({ name: "", type: "EXPENSE", color: "nope" }));

    expect(result.fieldErrors).toEqual({
      name: "Enter a name",
      color: "Pick a valid color",
    });
  });

  it("returns what the user typed, so the form can refill itself", async () => {
    const fields = { name: "Rent", type: "EXPENSE", color: "bad" };

    expect((await createCategoryAction(idle, form(fields))).values).toEqual(fields);
  });

  it("shows a duplicate on the name field and keeps the input", async () => {
    vi.mocked(createCategory).mockRejectedValue(duplicate());

    const result = await createCategoryAction(idle, form(valid));

    expect(result).toEqual({
      status: "error",
      errorCode: "DUPLICATE",
      fieldErrors: { name: "You already have a category with this name and type" },
      values: valid,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("lets the redirect for signed-out users through, without logging it as an error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const redirect = redirectError();
    vi.mocked(createCategory).mockRejectedValue(redirect);

    await expect(createCategoryAction(idle, form(valid))).rejects.toBe(redirect);

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logs anything unexpected once and rethrows it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("connection lost");
    vi.mocked(createCategory).mockRejectedValue(failure);

    await expect(createCategoryAction(idle, form(valid))).rejects.toBe(failure);

    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith("Unexpected error", failure);
  });

  it("ignores values that aren't text", async () => {
    const formData = form({ type: "EXPENSE", color: "#f59e0b" });
    formData.set("name", new File(["x"], "x.txt"));

    const result = await createCategoryAction(idle, formData);

    expect(result.fieldErrors?.name).toBe("Enter a name");
  });
});

describe("updateCategoryAction", () => {
  it("updates name and color of the bound category", async () => {
    const result = await updateCategoryAction("cat-1", idle, form({ name: "Food", color: "#10B981" }));

    expect(result).toEqual({ status: "success" });
    expect(updateCategory).toHaveBeenCalledWith("cat-1", { name: "Food", color: "#10b981" });
    expect(revalidatePath).toHaveBeenCalledWith("/categories");
    // A rename changes the category names shown on the transactions page and the dashboard
    expect(revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("ignores an attempt to change the type", async () => {
    await updateCategoryAction("cat-1", idle, form({ name: "Food", color: "#10b981", type: "INCOME" }));

    expect(updateCategory).toHaveBeenCalledWith("cat-1", { name: "Food", color: "#10b981" });
  });

  it("reports validation problems without saving", async () => {
    const result = await updateCategoryAction("cat-1", idle, form({ name: " ", color: "#10b981" }));

    expect(result.fieldErrors).toEqual({ name: "Enter a name" });
    expect(updateCategory).not.toHaveBeenCalled();
  });

  it("shows a duplicate on the name field", async () => {
    vi.mocked(updateCategory).mockRejectedValue(duplicate());

    const result = await updateCategoryAction("cat-1", idle, form({ name: "Rent", color: "#10b981" }));

    expect(result.fieldErrors?.name).toContain("already have");
  });

  it("explains a category that vanished, leaving the refresh to the dialog", async () => {
    vi.mocked(updateCategory).mockRejectedValue(AppError.notFound("category"));

    const result = await updateCategoryAction("gone", idle, form({ name: "Rent", color: "#10b981" }));

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("NOT_FOUND");
    expect(result.message).toContain("no longer exists");
    // Refreshing now would remove the row and the open dialog before the message is read
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rethrows unexpected errors", async () => {
    vi.mocked(updateCategory).mockRejectedValue(new Error("boom"));

    await expect(updateCategoryAction("cat-1", idle, form({ name: "Rent", color: "#10b981" }))).rejects.toThrow("boom");
  });
});

describe("deleteCategoryAction", () => {
  it("deletes and refreshes the pages that show categories", async () => {
    expect(await deleteCategoryAction("cat-1")).toEqual({ ok: true });
    expect(deleteCategory).toHaveBeenCalledWith("cat-1");
    expect(revalidatePath).toHaveBeenCalledWith("/categories");
    expect(revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("reports what still uses the category", async () => {
    vi.mocked(deleteCategory).mockRejectedValue(
      AppError.inUse("still used", { transactions: 12, budgets: 3 }),
    );

    expect(await deleteCategoryAction("cat-1")).toEqual({
      ok: false,
      error: {
        code: "IN_USE",
        message: "still used",
        details: { transactions: 12, budgets: 3 },
      },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a category that no longer exists", async () => {
    vi.mocked(deleteCategory).mockRejectedValue(AppError.notFound("category"));

    expect(await deleteCategoryAction("gone")).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: expect.stringContaining("category no longer exists") },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 42, {}, ""])("rejects the id %j without touching the database", async (id) => {
    expect(await deleteCategoryAction(id as never)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it("rethrows unexpected errors", async () => {
    vi.mocked(deleteCategory).mockRejectedValue(new Error("boom"));

    await expect(deleteCategoryAction("cat-1")).rejects.toThrow("boom");
  });
});
