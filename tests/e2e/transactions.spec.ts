import { expect, type Page } from "@playwright/test";
import {
  closeDatabase,
  deleteE2eUsers,
  findUser,
  hideNextDevIndicator,
  removeTransactionRow,
  seedCategory,
  seedTransaction,
  signUp,
  test,
  transactionsOf,
  type GoogleGrant,
} from "./helpers";

test.afterEach(deleteE2eUsers);
test.afterAll(closeDatabase);

const dialog = (page: Page) => page.getByRole("dialog");
const rows = (page: Page) => page.locator(".MuiDataGrid-row");
const rowWith = (page: Page, text: string) => rows(page).filter({ hasText: text });

const userIdOf = async (account: GoogleGrant) => (await findUser(account.email))!.id;

// A signed-in user with an expense and an income category, ready on /transactions
async function setUp(page: Page) {
  const account = await signUp(page);
  const userId = await userIdOf(account);
  const expense = await seedCategory(userId, "Groceries", "EXPENSE");
  const income = await seedCategory(userId, "Salary", "INCOME");
  return { account, userId, expense, income };
}

async function openAdd(page: Page) {
  await page.getByRole("button", { name: "Add transaction" }).click();
  await expect(dialog(page).getByRole("heading", { name: "Add transaction" })).toBeVisible();
}

async function chooseCategory(page: Page, name: string) {
  await dialog(page).getByRole("combobox", { name: /Category/ }).click();
  await page.getByRole("option", { name, exact: true }).click();
}

async function chooseFilter(page: Page, filter: "Type" | "Category", option: string) {
  await page.getByRole("combobox", { name: new RegExp(`^${filter}`) }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function fillForm(
  page: Page,
  fields: { description?: string; amount?: string; date?: string; note?: string; category?: string; type?: "Income" | "Expense" },
) {
  const form = dialog(page);
  if (fields.type) await form.getByRole("button", { name: fields.type, exact: true }).click();
  if (fields.description !== undefined) await form.getByLabel("Description").fill(fields.description);
  if (fields.amount !== undefined) await form.getByLabel("Amount").fill(fields.amount);
  if (fields.category) await chooseCategory(page, fields.category);
  if (fields.date !== undefined) await form.getByLabel("Date").fill(fields.date);
  if (fields.note !== undefined) await form.getByLabel("Note").fill(fields.note);
}

const save = (page: Page) => dialog(page).getByRole("button", { name: "Save" }).click();

// Skips the browser's own checks so the server's validation messages can be reached
const skipBrowserValidation = (page: Page) =>
  dialog(page).locator("form").evaluate((form: HTMLFormElement) => {
    form.noValidate = true;
  });

test.describe("the list", () => {
  test("is only for signed-in users", async ({ page }) => {
    await page.goto("/transactions");

    await expect(page).toHaveURL(/\/login$/);
  });

  test("shows the user's transactions with category names, types and cents", async ({ page }) => {
    const { userId, expense, income } = await setUp(page);
    await seedTransaction(userId, expense, { description: "Supermarket", amount: "123.45", date: "2026-10-27" });
    await seedTransaction(userId, income, { description: "October pay", amount: 7200, date: "2026-10-01", type: "INCOME" });

    await page.goto("/transactions");

    await expect(rows(page)).toHaveCount(2);
    // Newest first
    await expect(rows(page).nth(0)).toContainText("2026-10-27");
    await expect(rows(page).nth(0)).toContainText("Supermarket");
    await expect(rows(page).nth(0)).toContainText("Groceries");
    await expect(rows(page).nth(0)).toContainText("Expense");
    await expect(rows(page).nth(0)).toContainText("123.45");
    await expect(rows(page).nth(1)).toContainText("October pay");
    await expect(rows(page).nth(1)).toContainText("Salary");
    await expect(rows(page).nth(1)).toContainText("Income");
    await expect(rows(page).nth(1)).toContainText("7,200");
    await expect(rows(page).nth(1)).not.toContainText("7,200.");
  });

  test("says so when there are no transactions", async ({ page }) => {
    await setUp(page);
    await page.goto("/transactions");

    await expect(page.getByText("No transactions to show")).toBeVisible();
  });

  test("asks a user without categories to create one first", async ({ page }) => {
    await signUp(page);
    await page.goto("/transactions");

    await expect(page.getByText("Every transaction needs a category.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add transaction" })).toBeDisabled();

    await page.getByRole("link", { name: "Create your first category" }).click();
    await expect(page).toHaveURL(/\/categories$/);
  });

  test("pages through more than ten transactions", async ({ page }) => {
    const { userId, expense } = await setUp(page);
    for (let day = 1; day <= 12; day++) {
      await seedTransaction(userId, expense, {
        description: `Purchase ${day}`,
        amount: day,
        date: `2026-10-${String(day).padStart(2, "0")}`,
      });
    }

    await page.goto("/transactions");
    await expect(rows(page)).toHaveCount(10);
    await expect(rows(page).first()).toContainText("Purchase 12");

    await page.getByRole("button", { name: "Go to next page" }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).first()).toContainText("Purchase 2");
  });

  test("filters by search, type and category", async ({ page }) => {
    const { userId, expense, income } = await setUp(page);
    const dining = await seedCategory(userId, "Dining out", "EXPENSE");
    await seedTransaction(userId, expense, { description: "Supermarket", amount: 100, date: "2026-10-03" });
    await seedTransaction(userId, dining, { description: "Coffee with Dana", amount: 15, date: "2026-10-02" });
    await seedTransaction(userId, income, { description: "October pay", amount: 7200, date: "2026-10-01", type: "INCOME" });
    await page.goto("/transactions");
    await expect(rows(page)).toHaveCount(3);

    await page.getByLabel("Search").fill("coffee");
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Coffee with Dana");
    await page.getByLabel("Search").fill("");

    await chooseFilter(page, "Type", "Income");
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("October pay");

    await chooseFilter(page, "Type", "All");
    await chooseFilter(page, "Category", "Groceries");
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Supermarket");

    await page.getByLabel("Search").fill("nothing like this");
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByText("No transactions to show")).toBeVisible();
  });

  test("each user only sees their own transactions", async ({ page, browser }) => {
    const { userId, expense } = await setUp(page);
    await seedTransaction(userId, expense, { description: "Dana's private purchase", amount: 50, date: "2026-10-05" });
    await page.goto("/transactions");
    await expect(rowWith(page, "Dana's private purchase")).toBeVisible();

    const otherContext = await browser.newContext({ baseURL: "http://localhost:3100" });
    await hideNextDevIndicator(otherContext);
    const otherPage = await otherContext.newPage();
    await signUp(otherPage, "Noa Cohen");
    await otherPage.goto("/transactions");

    await expect(otherPage.getByText("Dana's private purchase")).toHaveCount(0);
    await expect(rows(otherPage)).toHaveCount(0);
    await otherContext.close();
  });
});

test.describe("adding", () => {
  test("adds an expense with cents, a date and a note", async ({ page }) => {
    const { account, expense } = await setUp(page);
    await page.goto("/transactions");
    await openAdd(page);

    await fillForm(page, { description: "Coffee", amount: "12.5", category: "Groceries", date: "2026-10-20", note: "with Dana" });
    await save(page);

    await expect(dialog(page)).toHaveCount(0);
    await expect(rowWith(page, "Coffee")).toContainText("12.50");
    await expect(rowWith(page, "Coffee")).toContainText("2026-10-20");
    expect(await transactionsOf(await userIdOf(account))).toMatchObject([
      {
        description: "Coffee",
        amount: "12.50",
        type: "EXPENSE",
        categoryId: expense,
        date: "2026-10-20",
        note: "with Dana",
        currency: "ILS",
      },
    ]);
  });

  test("adds an income", async ({ page }) => {
    const { account, income } = await setUp(page);
    await page.goto("/transactions");
    await openAdd(page);

    await fillForm(page, { type: "Income", description: "October pay", amount: "7200", category: "Salary", date: "2026-10-01" });
    await save(page);

    await expect(dialog(page)).toHaveCount(0);
    await expect(rowWith(page, "October pay")).toContainText("Income");
    expect(await transactionsOf(await userIdOf(account))).toMatchObject([
      { description: "October pay", amount: "7200.00", type: "INCOME", categoryId: income },
    ]);
  });

  test("keeps the transaction after a reload", async ({ page }) => {
    await setUp(page);
    await page.goto("/transactions");
    await openAdd(page);
    await fillForm(page, { description: "Persisted", amount: "9", category: "Groceries", date: "2026-10-02" });
    await save(page);
    await expect(rowWith(page, "Persisted")).toBeVisible();

    await page.reload();

    await expect(rowWith(page, "Persisted")).toBeVisible();
  });

  test("starts with today's date, and every opening starts fresh", async ({ page }) => {
    await setUp(page);
    await page.goto("/transactions");
    await openAdd(page);
    await expect(dialog(page).getByLabel("Date")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
    await fillForm(page, { description: "Half typed", amount: "5" });
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);

    await openAdd(page);

    await expect(dialog(page).getByLabel("Description")).toHaveValue("");
    await expect(dialog(page).getByLabel("Amount")).toHaveValue("");
  });

  test("only offers categories of the chosen type, and clears a category that no longer fits", async ({ page }) => {
    await setUp(page);
    await page.goto("/transactions");
    await openAdd(page);

    await dialog(page).getByRole("combobox", { name: /Category/ }).click();
    await expect(page.getByRole("option")).toHaveText(["Groceries"]);
    await page.getByRole("option", { name: "Groceries" }).click();
    await expect(dialog(page).getByRole("combobox", { name: /Category/ })).toContainText("Groceries");

    await dialog(page).getByRole("button", { name: "Income", exact: true }).click();

    await expect(dialog(page).getByRole("combobox", { name: /Category/ })).not.toContainText("Groceries");
    await dialog(page).getByRole("combobox", { name: /Category/ }).click();
    await expect(page.getByRole("option")).toHaveText(["Salary"]);
  });

  test("points to the categories page when the chosen type has no category", async ({ page }) => {
    const account = await signUp(page);
    await seedCategory(await userIdOf(account), "Groceries", "EXPENSE");
    await page.goto("/transactions");
    await openAdd(page);

    await dialog(page).getByRole("button", { name: "Income", exact: true }).click();

    await expect(dialog(page).getByText("You have no income categories yet.")).toBeVisible();
    await expect(dialog(page).getByRole("link", { name: "Create one on the Categories page." })).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("the browser stops an empty form before it reaches the server", async ({ page }) => {
    const { account } = await setUp(page);
    await page.goto("/transactions");
    await openAdd(page);

    await save(page);

    await expect(dialog(page).getByLabel("Description")).toBeFocused();
    expect(await transactionsOf(await userIdOf(account))).toEqual([]);
  });

  test("shows the server's validation errors next to the fields and keeps what was typed", async ({ page }) => {
    const { account } = await setUp(page);
    await page.goto("/transactions");
    await openAdd(page);
    await skipBrowserValidation(page);

    await fillForm(page, { description: "   ", amount: "0", date: "" });
    await save(page);

    await expect(dialog(page).getByText("Enter a description")).toBeVisible();
    await expect(dialog(page).getByText("Amount must be greater than zero")).toBeVisible();
    await expect(dialog(page).getByText("Enter a valid date")).toBeVisible();
    await expect(dialog(page).getByText("Choose a category")).toBeVisible();
    await expect(dialog(page).getByLabel("Amount")).toHaveAttribute("aria-invalid", "true");
    expect(await transactionsOf(await userIdOf(account))).toEqual([]);

    await fillForm(page, { description: "Kept", amount: "1.234", category: "Groceries", date: "2026-10-01" });
    await save(page);
    await expect(dialog(page).getByText("Enter an amount like 12.50")).toBeVisible();
    await expect(dialog(page).getByLabel("Description")).toHaveValue("Kept");
    await expect(dialog(page).getByLabel("Amount")).toHaveValue("1.234");

    await fillForm(page, { amount: "1.23" });
    await save(page);
    await expect(dialog(page)).toHaveCount(0);
    await expect(rowWith(page, "Kept")).toContainText("1.23");
  });
});

test.describe("editing", () => {
  test("opens with the transaction's values and saves the changes", async ({ page }) => {
    const { userId, expense } = await setUp(page);
    const dining = await seedCategory(userId, "Dining out", "EXPENSE");
    await seedTransaction(userId, expense, { description: "Lunch", amount: 40, date: "2026-10-10" });
    await page.goto("/transactions");

    await page.getByRole("button", { name: "Edit Lunch from 2026-10-10" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Edit transaction" })).toBeVisible();
    await expect(dialog(page).getByLabel("Description")).toHaveValue("Lunch");
    await expect(dialog(page).getByLabel("Amount")).toHaveValue("40");
    await expect(dialog(page).getByLabel("Date")).toHaveValue("2026-10-10");
    await expect(dialog(page).getByRole("combobox", { name: /Category/ })).toContainText("Groceries");
    await expect(dialog(page).getByRole("button", { name: "Expense", exact: true })).toHaveAttribute("aria-pressed", "true");

    await fillForm(page, { description: "Team lunch", amount: "55.5", category: "Dining out", date: "2026-10-12", note: "birthday" });
    await save(page);

    await expect(dialog(page)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Team lunch");
    await expect(rows(page).first()).toContainText("Dining out");
    await expect(rows(page).first()).toContainText("55.50");
    expect(await transactionsOf(userId)).toMatchObject([
      { description: "Team lunch", amount: "55.50", categoryId: dining, date: "2026-10-12", note: "birthday" },
    ]);
  });

  test("can turn an expense into an income by choosing a matching category", async ({ page }) => {
    const { userId, expense, income } = await setUp(page);
    await seedTransaction(userId, expense, { description: "Refund", amount: 30, date: "2026-10-10" });
    await page.goto("/transactions");
    await page.getByRole("button", { name: "Edit Refund from 2026-10-10" }).click();

    await dialog(page).getByRole("button", { name: "Income", exact: true }).click();
    await skipBrowserValidation(page);
    await save(page);
    await expect(dialog(page).getByText("Choose a category")).toBeVisible();

    await chooseCategory(page, "Salary");
    await save(page);

    await expect(dialog(page)).toHaveCount(0);
    await expect(rowWith(page, "Refund")).toContainText("Income");
    expect(await transactionsOf(userId)).toMatchObject([{ type: "INCOME", categoryId: income }]);
  });

  test("leaves the transaction unchanged when cancelled", async ({ page }) => {
    const { userId, expense } = await setUp(page);
    await seedTransaction(userId, expense, { description: "Lunch", amount: 40, date: "2026-10-10" });
    await page.goto("/transactions");
    await page.getByRole("button", { name: "Edit Lunch from 2026-10-10" }).click();
    await fillForm(page, { description: "Changed my mind" });

    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(rowWith(page, "Lunch")).toBeVisible();
    expect(await transactionsOf(userId)).toMatchObject([{ description: "Lunch" }]);
  });

  test("tells the user when the transaction was deleted elsewhere, then refreshes the list", async ({ page }) => {
    const { userId, expense } = await setUp(page);
    const id = await seedTransaction(userId, expense, { description: "Doomed", amount: 10, date: "2026-10-10" });
    await page.goto("/transactions");
    await page.getByRole("button", { name: "Edit Doomed from 2026-10-10" }).click();
    await fillForm(page, { description: "Renamed" });
    await removeTransactionRow(id);

    await save(page);

    await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByText("Doomed")).toHaveCount(0);
    await expect(page.getByText("Renamed")).toHaveCount(0);
  });
});

test.describe("deleting", () => {
  test("asks first, then removes the transaction", async ({ page }) => {
    const { userId, expense } = await setUp(page);
    await seedTransaction(userId, expense, { description: "Temporary", amount: "12.50", date: "2026-10-10" });
    await seedTransaction(userId, expense, { description: "Keeper", amount: 5, date: "2026-10-09" });
    await page.goto("/transactions");

    await page.getByRole("button", { name: "Delete Temporary from 2026-10-10" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Delete transaction?" })).toBeVisible();
    await expect(dialog(page)).toContainText("Temporary");
    await expect(dialog(page)).toContainText("12.50");
    await expect(dialog(page)).toContainText("2026-10-10");

    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByText("Temporary")).toHaveCount(0);
    await expect(rowWith(page, "Keeper")).toBeVisible();
    expect(await transactionsOf(userId)).toMatchObject([{ description: "Keeper" }]);
  });

  test("keeps the transaction when cancelled", async ({ page }) => {
    const { userId, expense } = await setUp(page);
    await seedTransaction(userId, expense, { description: "Keep me", amount: 10, date: "2026-10-10" });
    await page.goto("/transactions");

    await page.getByRole("button", { name: "Delete Keep me from 2026-10-10" }).click();
    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(rowWith(page, "Keep me")).toBeVisible();
    expect(await transactionsOf(userId)).toHaveLength(1);
  });

  test("tells the user when it was already deleted elsewhere, then refreshes the list", async ({ page }) => {
    const { userId, expense } = await setUp(page);
    const id = await seedTransaction(userId, expense, { description: "Doomed", amount: 10, date: "2026-10-10" });
    await page.goto("/transactions");
    await page.getByRole("button", { name: "Delete Doomed from 2026-10-10" }).click();
    await removeTransactionRow(id);

    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Doomed")).toHaveCount(0);
  });
});

test("a renamed category shows up on the transactions page", async ({ page }) => {
  const { userId, expense } = await setUp(page);
  await seedTransaction(userId, expense, { description: "Supermarket", amount: 100, date: "2026-10-03" });
  await page.goto("/transactions");
  await expect(rowWith(page, "Supermarket")).toContainText("Groceries");

  await page.goto("/categories");
  await page.getByRole("button", { name: "Edit Groceries" }).click();
  await dialog(page).getByLabel("Name").fill("Food");
  await dialog(page).getByRole("button", { name: "Save" }).click();
  await expect(dialog(page)).toHaveCount(0);

  await page.locator("aside").getByRole("link", { name: "Transactions" }).click();
  await expect(rowWith(page, "Supermarket")).toContainText("Food");
});
