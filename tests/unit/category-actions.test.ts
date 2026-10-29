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
import {
  CategoryInUseError,
  DuplicateCategoryError,
  NotFoundError,
} from "@/lib/data/errors";

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
};

const idle = { status: "idle" } as const;
const valid = { name: "Groceries", type: "EXPENSE", color: "#F59E0B" };

beforeEach(() => vi.resetAllMocks());

describe("createCategoryAction", () => {
  it("creates the category from cleaned-up input and refreshes the list", async () => {
    const result = await createCategoryAction(idle, form({ ...valid, name: "  Groceries " }));

    expect(result).toEqual({ status: "success" });
    expect(createCategory).toHaveBeenCalledWith({
      name: "Groceries",
      type: "EXPENSE",
      color: "#f59e0b",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/categories");
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
    vi.mocked(createCategory).mockRejectedValue(new DuplicateCategoryError());

    const result = await createCategoryAction(idle, form(valid));

    expect(result).toEqual({
      status: "error",
      fieldErrors: { name: "You already have a category with this name and type" },
      values: valid,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rethrows anything unexpected, such as the redirect for signed-out users", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login" });
    vi.mocked(createCategory).mockRejectedValue(redirect);

    await expect(createCategoryAction(idle, form(valid))).rejects.toBe(redirect);

    vi.mocked(createCategory).mockRejectedValue(new Error("connection lost"));
    await expect(createCategoryAction(idle, form(valid))).rejects.toThrow("connection lost");
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
    vi.mocked(updateCategory).mockRejectedValue(new DuplicateCategoryError());

    const result = await updateCategoryAction("cat-1", idle, form({ name: "Rent", color: "#10b981" }));

    expect(result.fieldErrors?.name).toContain("already have");
  });

  it("explains a category that vanished, leaving the refresh to the dialog", async () => {
    vi.mocked(updateCategory).mockRejectedValue(new NotFoundError("Category"));

    const result = await updateCategoryAction("gone", idle, form({ name: "Rent", color: "#10b981" }));

    expect(result.status).toBe("error");
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
  it("deletes and refreshes the list", async () => {
    expect(await deleteCategoryAction("cat-1")).toEqual({ ok: true });
    expect(deleteCategory).toHaveBeenCalledWith("cat-1");
    expect(revalidatePath).toHaveBeenCalledWith("/categories");
  });

  it("reports what still uses the category", async () => {
    vi.mocked(deleteCategory).mockRejectedValue(new CategoryInUseError(12, 3));

    expect(await deleteCategoryAction("cat-1")).toEqual({
      ok: false,
      reason: "in_use",
      transactions: 12,
      budgets: 3,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a category that no longer exists", async () => {
    vi.mocked(deleteCategory).mockRejectedValue(new NotFoundError("Category"));

    expect(await deleteCategoryAction("gone")).toEqual({ ok: false, reason: "not_found" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 42, {}, ""])("rejects the id %j without touching the database", async (id) => {
    expect(await deleteCategoryAction(id as never)).toEqual({ ok: false, reason: "not_found" });
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it("rethrows unexpected errors", async () => {
    vi.mocked(deleteCategory).mockRejectedValue(new Error("boom"));

    await expect(deleteCategoryAction("cat-1")).rejects.toThrow("boom");
  });
});
