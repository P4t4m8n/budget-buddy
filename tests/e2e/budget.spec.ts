import { expect, type Page } from "@playwright/test";
import { addMonths } from "../../lib/dates";
import { formatMonth } from "../../lib/format";
import {
  budgetsOf,
  cardValue,
  categoriesOf,
  closeDatabase,
  day,
  deleteE2eUsers,
  expectAmount,
  expectReadable,
  findUser,
  hideNextDevIndicator,
  removeBudgetRow,
  removeCategoryRow,
  seedBudget,
  seedCategory,
  seedTransaction,
  signUp,
  test,
  thisMonth,
  transactionsOf,
  type GoogleGrant,
} from "./helpers";

test.afterEach(deleteE2eUsers);
test.afterAll(closeDatabase);

const dialog = (page: Page) => page.getByRole("dialog");
const row = (page: Page, name: string) => page.getByRole("listitem", { name, exact: true });
const rowNames = (page: Page) =>
  page.getByRole("list").getByRole("listitem").evaluateAll((items) =>
    items.map((item) => item.getAttribute("aria-label")).filter(Boolean),
  );

const userIdOf = async (account: GoogleGrant) => (await findUser(account.email))!.id;

// A signed-in user with an income category and three expense categories
async function setUp(page: Page) {
  const account = await signUp(page);
  const userId = await userIdOf(account);
  return {
    userId,
    salary: await seedCategory(userId, "Salary", "INCOME", "#10b981"),
    groceries: await seedCategory(userId, "Groceries", "EXPENSE", "#f59e0b"),
    rent: await seedCategory(userId, "Rent", "EXPENSE", "#6366f1"),
    fun: await seedCategory(userId, "Fun", "EXPENSE", "#ec4899"),
  };
}

// Skips the browser's own checks so the server's validation messages can be reached
const skipBrowserValidation = (page: Page) =>
  dialog(page).locator("form").evaluate((form: HTMLFormElement) => {
    form.noValidate = true;
  });

test.describe("the list", () => {
  test("is only for signed-in users", async ({ page }) => {
    await page.goto("/budget");

    await expect(page).toHaveURL(/\/login$/);
  });

  test("asks a user without expense categories to create one", async ({ page }) => {
    const account = await signUp(page);
    await seedCategory(await userIdOf(account), "Salary", "INCOME");
    await page.goto("/budget");

    await expect(page.getByText("Budgets are set per expense category.")).toBeVisible();
    await expect(page.getByText("Salary")).toHaveCount(0);
    await expect(page.getByText("Total budget")).toHaveCount(0);

    await page.getByRole("link", { name: "Create an expense category" }).click();
    await expect(page).toHaveURL(/\/categories$/);
  });

  test("lists every expense category, budgeted ones first, with spending next to the limit", async ({ page }) => {
    const { userId, groceries, rent, fun } = await setUp(page);
    const month = thisMonth();
    await seedBudget(userId, groceries, month, 1200);
    await seedBudget(userId, rent, month, 2400);
    await seedTransaction(userId, groceries, { description: "Shop", amount: "430.25", date: day(month, 4) });
    await seedTransaction(userId, groceries, { description: "Shop", amount: 395, date: day(month, 27) });
    await seedTransaction(userId, rent, { description: "Rent", amount: 2400, date: day(month, 2) });
    await seedTransaction(userId, fun, { description: "Cinema", amount: "80.20", date: day(month, 9) });

    await page.goto("/budget");

    expect(await rowNames(page)).toEqual(["Groceries", "Rent", "Fun"]);
    await expectReadable(row(page, "Groceries"), "825.25 ₪ / 1,200 ₪");
    await expectReadable(row(page, "Rent"), "2,400 ₪ / 2,400 ₪");
    await expectReadable(row(page, "Fun"), "80.20 ₪ spent · no budget");
    await expect(page.getByText("Salary")).toHaveCount(0);

    const groceriesBar = page.getByRole("progressbar", { name: "Groceries budget used" });
    await expect(groceriesBar).toHaveAttribute("aria-valuemax", "1200");
    await expect(groceriesBar).toHaveAttribute("aria-valuenow", "825.25");
    await expect(page.getByRole("progressbar", { name: "Fun budget used" })).toHaveCount(0);

    await expectAmount(cardValue(page, "Total budget"), "3,600 ₪");
    await expectAmount(cardValue(page, "Spent"), "3,225.25 ₪");
    await expectAmount(cardValue(page, "Remaining"), "374.75 ₪");
    await expect(page.getByText(/Plus .*80\.20.* spent in categories without a budget\./)).toBeVisible();
  });

  test("shows a category without spending as just 'No budget'", async ({ page }) => {
    await setUp(page);
    await page.goto("/budget");

    await expectReadable(row(page, "Fun"), "No budget");
    await expect(page.getByText(/spent in categories without a budget/)).toHaveCount(0);
  });

  test("shows how far over budget a category is", async ({ page }) => {
    const { userId, rent } = await setUp(page);
    const month = thisMonth();
    await seedBudget(userId, rent, month, 2000);
    await seedTransaction(userId, rent, { description: "Rent", amount: 2400, date: day(month, 2) });

    await page.goto("/budget");

    await expectReadable(row(page, "Rent"), "Over budget by 400 ₪");
    await expectAmount(cardValue(page, "Remaining"), "-400 ₪");
    await expect(cardValue(page, "Remaining")).toHaveClass(/text-red-400/);
    await expect(page.getByRole("progressbar", { name: "Rent budget used" })).toHaveAttribute("aria-valuenow", "2000");
  });

  test("tells the user what to do in a month without budgets", async ({ page }) => {
    await setUp(page);
    await page.goto("/budget");

    await expect(page.getByText(`No budgets for ${formatMonth(thisMonth())} yet.`)).toBeVisible();
    await expect(page.getByText("Set a budget to compare it with your spending.")).toBeVisible();
    await expectAmount(cardValue(page, "Total budget"), "0 ₪");
  });

  test("draws the budget vs. spent chart once there is a budget", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    await seedBudget(userId, groceries, thisMonth(), 1200);

    await page.goto("/budget");

    const panel = page.locator("div").filter({ has: page.getByRole("heading", { name: "Budget vs. spent" }) }).last();
    await expect(panel.locator("svg").first()).toBeVisible();
    await expect(panel.getByText("Budget", { exact: true })).toBeVisible();
    await expect(panel.getByText("Spent", { exact: true })).toBeVisible();
    await expect(page.getByText("Set a budget to compare it with your spending.")).toHaveCount(0);
  });

  test("each user only sees their own budgets and spending", async ({ page, browser }) => {
    const { userId, groceries } = await setUp(page);
    await seedBudget(userId, groceries, thisMonth(), 1200);
    await page.goto("/budget");
    await expectAmount(cardValue(page, "Total budget"), "1,200 ₪");

    const otherContext = await browser.newContext({ baseURL: "http://localhost:3100" });
    await hideNextDevIndicator(otherContext);
    const otherPage = await otherContext.newPage();
    await signUp(otherPage, "Noa Cohen");
    await otherPage.goto("/budget");

    await expect(otherPage.getByText("Groceries")).toHaveCount(0);
    await expect(otherPage.getByText("Budgets are set per expense category.")).toBeVisible();
    await otherContext.close();
  });
});

test.describe("months", () => {
  test("moves between months and keeps each month's budgets apart", async ({ page }) => {
    const { userId, groceries, rent } = await setUp(page);
    const month = thisMonth();
    const lastMonth = addMonths(month, -1);
    await seedBudget(userId, groceries, month, 1200);
    await seedBudget(userId, rent, lastMonth, 2300);
    await seedTransaction(userId, rent, { description: "Rent", amount: 2300, date: day(lastMonth, 2) });
    await page.goto("/budget");
    await expect(page.getByText(formatMonth(month), { exact: true })).toBeVisible();
    await expectAmount(cardValue(page, "Total budget"), "1,200 ₪");

    await page.getByRole("link", { name: "Previous month" }).click();

    await expect(page).toHaveURL(new RegExp(`/budget\\?month=${lastMonth}$`));
    await expect(page.getByText(formatMonth(lastMonth), { exact: true })).toBeVisible();
    await expectAmount(cardValue(page, "Total budget"), "2,300 ₪");
    await expectAmount(cardValue(page, "Spent"), "2,300 ₪");
    await expectReadable(row(page, "Rent"), "2,300 ₪ / 2,300 ₪");
    await expectReadable(row(page, "Groceries"), "No budget");

    await page.getByRole("link", { name: "This month" }).click();

    await expect(page).toHaveURL(/\/budget$/);
    await expectAmount(cardValue(page, "Total budget"), "1,200 ₪");
    await expect(page.getByRole("link", { name: "This month" })).toHaveCount(0);
  });

  test("can plan the next month", async ({ page }) => {
    await setUp(page);
    const nextMonth = addMonths(thisMonth(), 1);
    await page.goto("/budget");

    await page.getByRole("link", { name: "Next month" }).click();

    await expect(page).toHaveURL(new RegExp(`/budget\\?month=${nextMonth}$`));
    await expect(page.getByText(formatMonth(nextMonth), { exact: true })).toBeVisible();
    await expect(page.getByText(`No budgets for ${formatMonth(nextMonth)} yet.`)).toBeVisible();
  });

  test("falls back to the current month for a month that isn't valid", async ({ page }) => {
    await setUp(page);

    for (const bad of ["nonsense", "2026-13", "2026-10-01", "1999-01", ""]) {
      await page.goto(`/budget?month=${bad}`);

      await expect(page.getByText(formatMonth(thisMonth()), { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "This month" })).toHaveCount(0);
    }
  });

  test("the month in the address is the month shown", async ({ page }) => {
    await setUp(page);

    await page.goto("/budget?month=2025-03");

    await expect(page.getByText("March 2025", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "This month" })).toBeVisible();
  });
});

test.describe("setting a budget", () => {
  test("sets a budget for a category in the month being viewed", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    const month = thisMonth();
    await page.goto("/budget");

    await page.getByRole("button", { name: "Set budget for Groceries" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Set budget" })).toBeVisible();
    await expect(dialog(page)).toContainText(`Groceries in ${formatMonth(month)}`);
    await dialog(page).getByLabel(/Monthly limit/).fill("1200.5");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(row(page, "Groceries"), "0 ₪ / 1,200.50 ₪");
    await expectAmount(cardValue(page, "Total budget"), "1,200.50 ₪");
    expect(await budgetsOf(userId)).toMatchObject([
      { categoryId: groceries, month, limit: "1200.50", currency: "ILS" },
    ]);
  });

  test("sets the budget for the month in the address, not the current one", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    const lastMonth = addMonths(thisMonth(), -1);
    await page.goto(`/budget?month=${lastMonth}`);

    await page.getByRole("button", { name: "Set budget for Groceries" }).click();
    await expect(dialog(page)).toContainText(formatMonth(lastMonth));
    await dialog(page).getByLabel(/Monthly limit/).fill("900");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    expect(await budgetsOf(userId)).toMatchObject([{ categoryId: groceries, month: lastMonth, limit: "900.00" }]);
  });

  test("keeps the budget after a reload", async ({ page }) => {
    await setUp(page);
    await page.goto("/budget");
    await page.getByRole("button", { name: "Set budget for Rent" }).click();
    await dialog(page).getByLabel(/Monthly limit/).fill("2400");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expectReadable(row(page, "Rent"), "0 ₪ / 2,400 ₪");

    await page.reload();

    await expectReadable(row(page, "Rent"), "0 ₪ / 2,400 ₪");
  });

  test("changes the limit of an existing budget instead of adding a second one", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    await seedBudget(userId, groceries, thisMonth(), 1200);
    await page.goto("/budget");

    await page.getByRole("button", { name: "Edit budget for Groceries" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Edit budget" })).toBeVisible();
    await expect(dialog(page).getByLabel(/Monthly limit/)).toHaveValue("1200");
    await dialog(page).getByLabel(/Monthly limit/).fill("1500");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(row(page, "Groceries"), "0 ₪ / 1,500 ₪");
    expect(await budgetsOf(userId)).toMatchObject([{ categoryId: groceries, limit: "1500.00" }]);
  });

  test("every opening of the form starts fresh", async ({ page }) => {
    await setUp(page);
    await page.goto("/budget");
    await page.getByRole("button", { name: "Set budget for Groceries" }).click();
    await dialog(page).getByLabel(/Monthly limit/).fill("777");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Set budget for Groceries" }).click();

    await expect(dialog(page).getByLabel(/Monthly limit/)).toHaveValue("");
  });

  test("leaves everything unchanged when cancelled", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    await seedBudget(userId, groceries, thisMonth(), 1200);
    await page.goto("/budget");
    await page.getByRole("button", { name: "Edit budget for Groceries" }).click();
    await dialog(page).getByLabel(/Monthly limit/).fill("5");

    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(row(page, "Groceries"), "/ 1,200 ₪");
    expect(await budgetsOf(userId)).toMatchObject([{ limit: "1200.00" }]);
  });

  test("the browser stops an empty limit before it reaches the server", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/budget");
    await page.getByRole("button", { name: "Set budget for Groceries" }).click();

    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByLabel(/Monthly limit/)).toBeFocused();
    expect(await budgetsOf(userId)).toEqual([]);
  });

  test("shows the server's validation error next to the field and keeps what was typed", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/budget");
    await page.getByRole("button", { name: "Set budget for Groceries" }).click();
    await skipBrowserValidation(page);

    await dialog(page).getByLabel(/Monthly limit/).fill("0");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByText("Amount must be greater than zero")).toBeVisible();
    await expect(dialog(page).getByLabel(/Monthly limit/)).toHaveAttribute("aria-invalid", "true");
    expect(await budgetsOf(userId)).toEqual([]);

    await dialog(page).getByLabel(/Monthly limit/).fill("1.234");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page).getByText("Enter an amount like 12.50")).toBeVisible();
    await expect(dialog(page).getByLabel(/Monthly limit/)).toHaveValue("1.234");

    await dialog(page).getByLabel(/Monthly limit/).fill("1.23");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(row(page, "Groceries"), "/ 1.23 ₪");
  });

  test("says so when the category was deleted elsewhere, then refreshes the list", async ({ page }) => {
    const { userId, fun } = await setUp(page);
    await page.goto("/budget");
    await page.getByRole("button", { name: "Set budget for Fun" }).click();
    await dialog(page).getByLabel(/Monthly limit/).fill("100");
    await removeCategoryRow(fun);

    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("Choose one of your expense categories");
    expect(await budgetsOf(userId)).toEqual([]);
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(row(page, "Fun")).toHaveCount(0);
  });
});

test.describe("removing a budget", () => {
  test("asks first, then removes the budget but not the transactions", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    const month = thisMonth();
    await seedBudget(userId, groceries, month, 1200);
    await seedTransaction(userId, groceries, { description: "Shop", amount: 300, date: day(month, 4) });
    await page.goto("/budget");

    await page.getByRole("button", { name: "Remove budget for Groceries" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Remove budget?" })).toBeVisible();
    await expect(dialog(page)).toContainText("Groceries");
    await expect(dialog(page)).toContainText(formatMonth(month));
    await expect(dialog(page)).toContainText("1,200");
    await expect(dialog(page)).toContainText("Your transactions are not affected.");

    await dialog(page).getByRole("button", { name: "Remove", exact: true }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(row(page, "Groceries"), "300 ₪ spent · no budget");
    await expect(page.getByRole("button", { name: "Remove budget for Groceries" })).toHaveCount(0);
    expect(await budgetsOf(userId)).toEqual([]);
    expect(await transactionsOf(userId)).toHaveLength(1);
  });

  test("keeps the budget when cancelled", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    await seedBudget(userId, groceries, thisMonth(), 1200);
    await page.goto("/budget");

    await page.getByRole("button", { name: "Remove budget for Groceries" }).click();
    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(row(page, "Groceries"), "/ 1,200 ₪");
    expect(await budgetsOf(userId)).toHaveLength(1);
  });

  test("says so when it was already removed elsewhere, then refreshes the list", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    const id = await seedBudget(userId, groceries, thisMonth(), 1200);
    await page.goto("/budget");
    await page.getByRole("button", { name: "Remove budget for Groceries" }).click();
    await removeBudgetRow(id);

    await dialog(page).getByRole("button", { name: "Remove", exact: true }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(row(page, "Groceries"), "No budget");
  });
});

test.describe("categories and budgets", () => {
  test("a category with a budget can't be deleted until the budget is removed", async ({ page }) => {
    const { userId, fun } = await setUp(page);
    await seedBudget(userId, fun, thisMonth(), 100);

    await page.goto("/categories");
    await page.getByRole("button", { name: "Delete Fun" }).click();
    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("“Fun” is still used by 1 budget.");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await page.locator("aside").getByRole("link", { name: "Budget", exact: true }).click();
    await page.getByRole("button", { name: "Remove budget for Fun" }).click();
    await dialog(page).getByRole("button", { name: "Remove", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);

    await page.locator("aside").getByRole("link", { name: "Categories" }).click();
    await page.getByRole("button", { name: "Delete Fun" }).click();
    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    // Scoped to the categories list: the budget page stays mounted in the background
    await expect(page.getByRole("region", { name: "Expenses" }).getByText("Fun")).toHaveCount(0);
    expect((await categoriesOf(userId)).map((c) => c.name)).not.toContain("Fun");
  });

  test("a new transaction shows up in the budget", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    await seedBudget(userId, groceries, thisMonth(), 1200);
    await page.goto("/budget");
    await expectReadable(row(page, "Groceries"), "0 ₪ / 1,200 ₪");

    await page.locator("aside").getByRole("link", { name: "Transactions" }).click();
    await page.getByRole("button", { name: "Add transaction" }).click();
    await dialog(page).getByLabel("Description").fill("Weekly shop");
    await dialog(page).getByLabel("Amount").fill("250");
    await dialog(page).getByRole("combobox", { name: /Category/ }).click();
    await page.getByRole("option", { name: "Groceries", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page)).toHaveCount(0);

    await page.locator("aside").getByRole("link", { name: "Budget", exact: true }).click();

    await expectReadable(row(page, "Groceries"), "250 ₪ / 1,200 ₪");
  });
});
