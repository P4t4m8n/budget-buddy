import { expect, type Page } from "@playwright/test";
import {
  categoriesOf,
  closeDatabase,
  deleteE2eUsers,
  findUser,
  hideNextDevIndicator,
  insertTransaction,
  removeCategoryRow,
  signUp,
  test,
} from "./helpers";

test.afterEach(deleteE2eUsers);
test.afterAll(closeDatabase);

const section = (page: Page, name: "Income" | "Expenses") => page.getByRole("region", { name });
const dialog = (page: Page) => page.getByRole("dialog");

async function openAddDialog(page: Page) {
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(dialog(page).getByRole("heading", { name: "Add category" })).toBeVisible();
}

async function addCategory(
  page: Page,
  { name, type = "EXPENSE", color }: { name: string; type?: "INCOME" | "EXPENSE"; color?: string },
) {
  await openAddDialog(page);
  if (type === "INCOME") await dialog(page).getByRole("button", { name: "Income" }).click();
  await dialog(page).getByLabel("Name").fill(name);
  if (color) await dialog(page).getByRole("button", { name: `Use color ${color}` }).click();
  await dialog(page).getByRole("button", { name: "Save" }).click();
  await expect(dialog(page)).toHaveCount(0);
}

test("is only for signed-in users and reachable from the sidebar", async ({ page, browser }) => {
  const signedOut = await browser.newContext({ baseURL: "http://localhost:3100" });
  const signedOutPage = await signedOut.newPage();
  await signedOutPage.goto("/categories");
  await expect(signedOutPage).toHaveURL(/\/login$/);
  await signedOut.close();

  await signUp(page);
  await page.locator("aside").getByRole("link", { name: "Categories" }).click();

  await expect(page).toHaveURL(/\/categories$/);
  await expect(page.getByRole("heading", { name: "Categories" })).toBeVisible();
});

test("explains what to do when a new user has no categories", async ({ page }) => {
  await signUp(page);
  await page.goto("/categories");

  await expect(page.getByText("No categories yet. Add at least one income")).toBeVisible();
  await expect(section(page, "Income").getByText("No income categories yet.")).toBeVisible();
  await expect(section(page, "Expenses").getByText("No expense categories yet.")).toBeVisible();
});

test("adds an expense and an income category", async ({ page }) => {
  const account = await signUp(page);
  await page.goto("/categories");

  await addCategory(page, { name: "Groceries", color: "#f59e0b" });
  await addCategory(page, { name: "Salary", type: "INCOME", color: "#10b981" });

  await expect(section(page, "Expenses").getByText("Groceries")).toBeVisible();
  await expect(section(page, "Income").getByText("Salary")).toBeVisible();
  await expect(page.getByText("No categories yet. Add at least one income")).toHaveCount(0);

  const rows = await categoriesOf((await findUser(account.email))!.id);
  expect(rows).toMatchObject([
    { name: "Groceries", type: "EXPENSE", color: "#f59e0b" },
    { name: "Salary", type: "INCOME", color: "#10b981" },
  ]);
});

test("keeps categories after a reload", async ({ page }) => {
  await signUp(page);
  await page.goto("/categories");
  await addCategory(page, { name: "Rent" });

  await page.reload();

  await expect(section(page, "Expenses").getByText("Rent")).toBeVisible();
});

test("accepts a custom color from the color picker", async ({ page }) => {
  const account = await signUp(page);
  await page.goto("/categories");
  await openAddDialog(page);

  await dialog(page).getByLabel("Name").fill("Custom");
  await dialog(page).getByLabel("Custom color").fill("#123abc");
  await dialog(page).getByRole("button", { name: "Save" }).click();
  await expect(dialog(page)).toHaveCount(0);

  expect(await categoriesOf((await findUser(account.email))!.id)).toMatchObject([
    { name: "Custom", color: "#123abc" },
  ]);
});

test("every opening of the form starts fresh", async ({ page }) => {
  await signUp(page);
  await page.goto("/categories");
  await openAddDialog(page);
  await dialog(page).getByLabel("Name").fill("Half typed");
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dialog(page)).toHaveCount(0);

  await openAddDialog(page);

  await expect(dialog(page).getByLabel("Name")).toHaveValue("");
});

test("shows a validation error from the server and keeps what was typed", async ({ page }) => {
  const account = await signUp(page);
  await page.goto("/categories");
  await openAddDialog(page);

  // Spaces pass the browser's "required" check but not the server's
  await dialog(page).getByLabel("Name").fill("   ");
  await dialog(page).getByRole("button", { name: "Save" }).click();

  await expect(dialog(page).getByText("Enter a name")).toBeVisible();
  await expect(dialog(page)).toBeVisible();
  expect(await categoriesOf((await findUser(account.email))!.id)).toEqual([]);

  await dialog(page).getByLabel("Name").fill("Fixed");
  await dialog(page).getByRole("button", { name: "Save" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(section(page, "Expenses").getByText("Fixed")).toBeVisible();
});

test("rejects a duplicate on the name field and keeps the dialog open", async ({ page }) => {
  const account = await signUp(page);
  await page.goto("/categories");
  await addCategory(page, { name: "Groceries" });

  await openAddDialog(page);
  await dialog(page).getByLabel("Name").fill("Groceries");
  await dialog(page).getByRole("button", { name: "Save" }).click();

  await expect(dialog(page).getByText("You already have a category with this name and type")).toBeVisible();
  await expect(dialog(page).getByLabel("Name")).toHaveValue("Groceries");
  await expect(dialog(page).getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
  expect(await categoriesOf((await findUser(account.email))!.id)).toHaveLength(1);
});

test("allows the same name for income and expenses", async ({ page }) => {
  await signUp(page);
  await page.goto("/categories");
  await addCategory(page, { name: "Other" });

  await addCategory(page, { name: "Other", type: "INCOME" });

  await expect(section(page, "Expenses").getByText("Other")).toBeVisible();
  await expect(section(page, "Income").getByText("Other")).toBeVisible();
});

test("renames and recolors a category, but its type is fixed", async ({ page }) => {
  const account = await signUp(page);
  await page.goto("/categories");
  await addCategory(page, { name: "Groceries", color: "#f59e0b" });

  await page.getByRole("button", { name: "Edit Groceries" }).click();
  await expect(dialog(page).getByRole("heading", { name: "Edit category" })).toBeVisible();
  await expect(dialog(page).getByText("Type: Expense")).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Income" })).toHaveCount(0);
  await expect(dialog(page).getByLabel("Name")).toHaveValue("Groceries");
  await expect(dialog(page).getByRole("button", { name: "Use color #f59e0b" })).toHaveAttribute("aria-pressed", "true");

  await dialog(page).getByLabel("Name").fill("Food");
  await dialog(page).getByRole("button", { name: "Use color #6366f1" }).click();
  await dialog(page).getByRole("button", { name: "Save" }).click();
  await expect(dialog(page)).toHaveCount(0);

  await expect(section(page, "Expenses").getByText("Food")).toBeVisible();
  await expect(page.getByText("Groceries")).toHaveCount(0);
  expect(await categoriesOf((await findUser(account.email))!.id)).toMatchObject([
    { name: "Food", type: "EXPENSE", color: "#6366f1" },
  ]);
});

test("rejects renaming onto an existing category", async ({ page }) => {
  await signUp(page);
  await page.goto("/categories");
  await addCategory(page, { name: "Rent" });
  await addCategory(page, { name: "Groceries" });

  await page.getByRole("button", { name: "Edit Groceries" }).click();
  await dialog(page).getByLabel("Name").fill("Rent");
  await dialog(page).getByRole("button", { name: "Save" }).click();

  await expect(dialog(page).getByText("already have a category")).toBeVisible();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(section(page, "Expenses").getByText("Groceries")).toBeVisible();
});

test("deletes an unused category after confirming", async ({ page }) => {
  const account = await signUp(page);
  await page.goto("/categories");
  await addCategory(page, { name: "Temporary" });

  await page.getByRole("button", { name: "Delete Temporary" }).click();
  await expect(dialog(page).getByRole("heading", { name: "Delete category?" })).toBeVisible();
  await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByText("Temporary")).toHaveCount(0);
  expect(await categoriesOf((await findUser(account.email))!.id)).toEqual([]);
});

test("keeps the category when the delete is cancelled", async ({ page }) => {
  await signUp(page);
  await page.goto("/categories");
  await addCategory(page, { name: "Keep me" });

  await page.getByRole("button", { name: "Delete Keep me" }).click();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();

  await expect(dialog(page)).toHaveCount(0);
  await expect(section(page, "Expenses").getByText("Keep me")).toBeVisible();
});

test("won't delete a category that transactions still use, and says how many", async ({ page }) => {
  const account = await signUp(page);
  await page.goto("/categories");
  await addCategory(page, { name: "Groceries" });
  const userId = (await findUser(account.email))!.id;
  const [category] = await categoriesOf(userId);
  await insertTransaction(userId, category.id);
  await insertTransaction(userId, category.id);

  await page.getByRole("button", { name: "Delete Groceries" }).click();
  await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

  await expect(dialog(page).getByRole("alert")).toContainText(
    "“Groceries” is still used by 2 transactions. Move or delete them first.",
  );
  await expect(dialog(page)).toBeVisible();
  expect(await categoriesOf(userId)).toHaveLength(1);

  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(dialog(page).getByRole("alert")).toHaveCount(0);
  await expect(section(page, "Expenses").getByText("Groceries")).toBeVisible();
});

test("tells the user when a category was already deleted elsewhere", async ({ page }) => {
  const account = await signUp(page);
  await page.goto("/categories");
  await addCategory(page, { name: "Doomed" });
  const [category] = await categoriesOf((await findUser(account.email))!.id);

  await page.getByRole("button", { name: "Edit Doomed" }).click();
  await dialog(page).getByLabel("Name").fill("Renamed");
  await removeCategoryRow(category.id);
  await dialog(page).getByRole("button", { name: "Save" }).click();

  await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Doomed")).toHaveCount(0);
  await expect(page.getByText("Renamed")).toHaveCount(0);
});

test("deleting a category that is already gone says so, then refreshes the list", async ({ page }) => {
  const account = await signUp(page);
  await page.goto("/categories");
  await addCategory(page, { name: "Doomed" });
  const [category] = await categoriesOf((await findUser(account.email))!.id);

  await page.getByRole("button", { name: "Delete Doomed" }).click();
  await removeCategoryRow(category.id);
  await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

  await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Doomed")).toHaveCount(0);
});

test("each user only sees and manages their own categories", async ({ page, browser }) => {
  await signUp(page, "Dana Levi");
  await page.goto("/categories");
  await addCategory(page, { name: "Dana's secret" });

  const otherContext = await browser.newContext({ baseURL: "http://localhost:3100" });
  await hideNextDevIndicator(otherContext);
  const otherPage = await otherContext.newPage();
  await signUp(otherPage, "Noa Cohen");
  await otherPage.goto("/categories");

  await expect(otherPage.getByText("Dana's secret")).toHaveCount(0);
  await expect(otherPage.getByText("No categories yet. Add at least one income")).toBeVisible();

  await addCategory(otherPage, { name: "Dana's secret" });
  await expect(section(otherPage, "Expenses").getByText("Dana's secret")).toBeVisible();
  await otherContext.close();
});
