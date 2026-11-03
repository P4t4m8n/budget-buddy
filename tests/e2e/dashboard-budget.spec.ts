import { expect, type Page } from "@playwright/test";
import { addMonths } from "../../lib/dates";
import {
  closeDatabase,
  day,
  deleteE2eUsers,
  expectReadable,
  findUser,
  hideNextDevIndicator,
  seedBudget,
  seedCategory,
  seedMonthlyBudget,
  seedTransaction,
  signUp,
  test,
  thisMonth,
  type GoogleGrant,
} from "./helpers";
import { formatMonth } from "../../lib/format";

test.afterEach(deleteE2eUsers);
test.afterAll(closeDatabase);

const userIdOf = async (account: GoogleGrant) => (await findUser(account.email))!.id;
const dialog = (page: Page) => page.getByRole("dialog");
const progress = (page: Page) => page.getByRole("region", { name: "Budget progress" });
const bar = (page: Page, name: string) => progress(page).getByRole("progressbar", { name });
// The coloured part of a progress bar
const fill = (page: Page, name: string) => bar(page, name).locator("div");
const item = (page: Page, name: string) => progress(page).getByRole("listitem", { name, exact: true });
const itemNames = (page: Page) =>
  progress(page).getByRole("listitem").evaluateAll((items) => items.map((i) => i.getAttribute("aria-label")));
const sidebar = (page: Page, name: string) => page.locator("aside").getByRole("link", { name, exact: true });

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

test.describe("without a budget", () => {
  test("asks a user without any budget this month to set one, with a link to the Budget page", async ({ page }) => {
    await setUp(page);
    await page.goto("/dashboard");

    await expect(progress(page).getByText(`No budget set for ${formatMonth(thisMonth())} yet.`)).toBeVisible();
    await expect(progress(page).getByRole("progressbar")).toHaveCount(0);
    await expect(progress(page).getByRole("link", { name: "Manage budgets" })).toHaveCount(0);

    await progress(page).getByRole("link", { name: "Set one on the Budget page" }).click();

    await expect(page).toHaveURL(/\/budget$/);
  });

  test("still asks when the only budgets are for other months", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    const month = thisMonth();
    await seedMonthlyBudget(userId, addMonths(month, -1), 4000);
    await seedBudget(userId, groceries, addMonths(month, 1), 500);

    await page.goto("/dashboard");

    await expect(progress(page).getByText(/No budget set for/)).toBeVisible();
    await expect(progress(page).getByRole("progressbar")).toHaveCount(0);
  });
});

test.describe("the monthly budget", () => {
  test("shows what was spent of it, what is left, and a progress bar", async ({ page }) => {
    const { userId, groceries, fun, salary } = await setUp(page);
    const month = thisMonth();
    await seedMonthlyBudget(userId, month, 4000);
    await seedTransaction(userId, groceries, { description: "Shop", amount: "430.25", date: day(month, 4) });
    // No budget of its own, but it counts against the monthly one; income doesn't
    await seedTransaction(userId, fun, { description: "Cinema", amount: "80.20", date: day(month, 9) });
    await seedTransaction(userId, salary, { description: "Pay", amount: 7200, date: day(month, 1), type: "INCOME" });

    await page.goto("/dashboard");

    await expect(progress(page).getByText("Monthly budget", { exact: true })).toBeVisible();
    await expectReadable(progress(page), "510.45 ₪ of 4,000 ₪");
    await expectReadable(progress(page), "3,489.55 ₪ left to spend");
    await expect(bar(page, "Monthly budget used")).toHaveAttribute("aria-valuemax", "4000");
    await expect(bar(page, "Monthly budget used")).toHaveAttribute("aria-valuenow", "510.45");
    await expect(fill(page, "Monthly budget used")).toHaveClass(/bg-emerald-500/);
    await expect(progress(page).getByText("By category")).toHaveCount(0);
    await expect(progress(page).getByRole("link", { name: "Manage budgets" })).toBeVisible();
  });

  test("turns amber near the limit", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    const month = thisMonth();
    await seedMonthlyBudget(userId, month, 1000);
    await seedTransaction(userId, groceries, { description: "Shop", amount: 850, date: day(month, 4) });

    await page.goto("/dashboard");

    await expect(fill(page, "Monthly budget used")).toHaveClass(/bg-amber-500/);
    await expectReadable(progress(page), "150 ₪ left to spend");
  });

  test("turns red and says by how much when over", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    const month = thisMonth();
    await seedMonthlyBudget(userId, month, 500);
    await seedTransaction(userId, groceries, { description: "Shop", amount: 650, date: day(month, 4) });

    await page.goto("/dashboard");

    await expect(fill(page, "Monthly budget used")).toHaveClass(/bg-red-500/);
    await expectReadable(progress(page), "Over the monthly budget by 150 ₪");
    await expect(progress(page).getByText("left to spend")).toHaveCount(0);
    await expect(bar(page, "Monthly budget used")).toHaveAttribute("aria-valuenow", "500");
  });

  test("isn't over when spending matches it exactly", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    const month = thisMonth();
    await seedMonthlyBudget(userId, month, 500);
    await seedTransaction(userId, groceries, { description: "Shop", amount: 500, date: day(month, 4) });

    await page.goto("/dashboard");

    await expectReadable(progress(page), "0 ₪ left to spend");
    await expect(progress(page).getByText(/Over the monthly budget/)).toHaveCount(0);
  });
});

test.describe("the category budgets", () => {
  test("lists every category that has a budget, with what was spent of it", async ({ page }) => {
    const { userId, groceries, rent, fun } = await setUp(page);
    const month = thisMonth();
    await seedBudget(userId, groceries, month, 1200);
    await seedBudget(userId, rent, month, "2400.50");
    await seedTransaction(userId, groceries, { description: "Shop", amount: "430.25", date: day(month, 4) });
    await seedTransaction(userId, rent, { description: "Rent", amount: 2400, date: day(month, 2) });
    // A category without a budget isn't listed
    await seedTransaction(userId, fun, { description: "Cinema", amount: 80, date: day(month, 9) });

    await page.goto("/dashboard");

    await expect(progress(page).getByText("By category")).toBeVisible();
    await expect.poll(() => itemNames(page)).toEqual(["Rent", "Groceries"]);
    await expectReadable(item(page, "Groceries"), "430.25 ₪ / 1,200 ₪");
    await expectReadable(item(page, "Rent"), "2,400 ₪ / 2,400.50 ₪");
    await expect(item(page, "Fun")).toHaveCount(0);
    await expect(progress(page).getByText("Monthly budget", { exact: true })).toHaveCount(0);
    await expect(bar(page, "Groceries budget used")).toHaveAttribute("aria-valuemax", "1200");
    await expect(bar(page, "Groceries budget used")).toHaveAttribute("aria-valuenow", "430.25");
  });

  test("puts the categories closest to their limit first", async ({ page }) => {
    const { userId, groceries, rent, fun } = await setUp(page);
    const month = thisMonth();
    await seedBudget(userId, groceries, month, 1000);
    await seedBudget(userId, rent, month, 1000);
    await seedBudget(userId, fun, month, 1000);
    await seedTransaction(userId, groceries, { description: "Shop", amount: 900, date: day(month, 4) });
    await seedTransaction(userId, rent, { description: "Rent", amount: 1200, date: day(month, 2) });
    await seedTransaction(userId, fun, { description: "Cinema", amount: 100, date: day(month, 9) });

    await page.goto("/dashboard");

    await expect.poll(() => itemNames(page)).toEqual(["Rent", "Groceries", "Fun"]);
  });

  test("shows green, amber and red bars, and how far over a category is", async ({ page }) => {
    const { userId, groceries, rent, fun } = await setUp(page);
    const month = thisMonth();
    await seedBudget(userId, groceries, month, 1000);
    await seedBudget(userId, rent, month, 1000);
    await seedBudget(userId, fun, month, 1000);
    await seedTransaction(userId, groceries, { description: "Shop", amount: 100, date: day(month, 4) });
    await seedTransaction(userId, rent, { description: "Rent", amount: 850, date: day(month, 2) });
    await seedTransaction(userId, fun, { description: "Cinema", amount: 1150, date: day(month, 9) });

    await page.goto("/dashboard");

    await expect(fill(page, "Groceries budget used")).toHaveClass(/bg-emerald-500/);
    await expect(fill(page, "Rent budget used")).toHaveClass(/bg-amber-500/);
    await expect(fill(page, "Fun budget used")).toHaveClass(/bg-red-500/);
    await expectReadable(item(page, "Fun"), "Over budget by 150 ₪");
    await expect(item(page, "Rent")).not.toContainText("Over budget");
    await expect(item(page, "Groceries")).not.toContainText("Over budget");
  });

  test("lists a budgeted category that nothing has been spent in yet", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    await seedBudget(userId, groceries, thisMonth(), 500);

    await page.goto("/dashboard");

    await expectReadable(item(page, "Groceries"), "0 ₪ / 500 ₪");
  });

  test("only shows this month's budgets", async ({ page }) => {
    const { userId, groceries, rent } = await setUp(page);
    const month = thisMonth();
    await seedBudget(userId, groceries, addMonths(month, -1), 300);
    await seedBudget(userId, rent, month, 400);

    await page.goto("/dashboard");

    await expect.poll(() => itemNames(page)).toEqual(["Rent"]);
  });
});

test.describe("both budgets", () => {
  test("shows the monthly budget first, then the categories, and each is judged on its own", async ({ page }) => {
    const { userId, groceries, rent } = await setUp(page);
    const month = thisMonth();
    await seedMonthlyBudget(userId, month, 5000);
    await seedBudget(userId, groceries, month, 300);
    await seedBudget(userId, rent, month, 3000);
    await seedTransaction(userId, groceries, { description: "Shop", amount: 450, date: day(month, 4) });
    await seedTransaction(userId, rent, { description: "Rent", amount: 2400, date: day(month, 2) });

    await page.goto("/dashboard");

    await expect(progress(page).getByText("Monthly budget", { exact: true })).toBeVisible();
    await expectReadable(progress(page), "2,850 ₪ of 5,000 ₪");
    await expectReadable(progress(page), "2,150 ₪ left to spend");
    await expect(progress(page).getByText(/Over the monthly budget/)).toHaveCount(0);
    await expectReadable(item(page, "Groceries"), "Over budget by 150 ₪");
    await expect.poll(() => itemNames(page)).toEqual(["Groceries", "Rent"]);
  });

  test("can be over the monthly budget while every category is within its own", async ({ page }) => {
    const { userId, groceries, rent } = await setUp(page);
    const month = thisMonth();
    await seedMonthlyBudget(userId, month, 1000);
    await seedBudget(userId, groceries, month, 800);
    await seedBudget(userId, rent, month, 800);
    await seedTransaction(userId, groceries, { description: "Shop", amount: 700, date: day(month, 4) });
    await seedTransaction(userId, rent, { description: "Rent", amount: 700, date: day(month, 2) });

    await page.goto("/dashboard");

    await expectReadable(progress(page), "Over the monthly budget by 400 ₪");
    await expect(item(page, "Groceries")).not.toContainText("Over budget");
    await expect(item(page, "Rent")).not.toContainText("Over budget");
  });

  test("links to the Budget page", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedMonthlyBudget(userId, thisMonth(), 1000);
    await page.goto("/dashboard");

    await progress(page).getByRole("link", { name: "Manage budgets" }).click();

    await expect(page).toHaveURL(/\/budget$/);
  });
});

test.describe("staying up to date", () => {
  test("follows a change to the monthly budget made on the Budget page", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedMonthlyBudget(userId, thisMonth(), 1000);
    await page.goto("/dashboard");
    await expectReadable(progress(page), "0 ₪ of 1,000 ₪");

    await sidebar(page, "Budget").click();
    await page.getByRole("button", { name: "Edit monthly budget" }).click();
    await dialog(page).getByLabel(/Limit for the month/).fill("2500");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await sidebar(page, "Dashboard").click();

    await expectReadable(progress(page), "0 ₪ of 2,500 ₪");
  });

  test("shows a budget set on the Budget page, and drops one that was removed", async ({ page }) => {
    await setUp(page);
    await page.goto("/dashboard");
    await expect(progress(page).getByText(/No budget set for/)).toBeVisible();

    await sidebar(page, "Budget").click();
    await page.getByRole("button", { name: "Set budget for Groceries" }).click();
    await dialog(page).getByLabel(/Monthly limit/).fill("1200");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await sidebar(page, "Dashboard").click();

    await expectReadable(item(page, "Groceries"), "0 ₪ / 1,200 ₪");
    await expect(progress(page).getByText(/No budget set for/)).toHaveCount(0);

    await sidebar(page, "Budget").click();
    await page.getByRole("button", { name: "Remove budget for Groceries" }).click();
    await dialog(page).getByRole("button", { name: "Remove", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    await sidebar(page, "Dashboard").click();

    await expect(progress(page).getByText(/No budget set for/)).toBeVisible();
  });

  test("follows a new transaction", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedMonthlyBudget(userId, thisMonth(), 1000);
    await page.goto("/dashboard");
    await expectReadable(progress(page), "1,000 ₪ left to spend");

    await sidebar(page, "Transactions").click();
    await page.getByRole("button", { name: "Add transaction" }).click();
    await dialog(page).getByLabel("Description").fill("Weekly shop");
    await dialog(page).getByLabel("Amount").fill("250");
    await dialog(page).getByRole("combobox", { name: /Category/ }).click();
    await page.getByRole("option", { name: "Groceries", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await sidebar(page, "Dashboard").click();

    await expectReadable(progress(page), "250 ₪ of 1,000 ₪");
    await expectReadable(progress(page), "750 ₪ left to spend");
  });
});

test("each user only sees their own budgets", async ({ page, browser }) => {
  const { userId } = await setUp(page);
  await seedMonthlyBudget(userId, thisMonth(), 4000);
  await page.goto("/dashboard");
  await expectReadable(progress(page), "0 ₪ of 4,000 ₪");

  const otherContext = await browser.newContext({ baseURL: "http://localhost:3100" });
  await hideNextDevIndicator(otherContext);
  const otherPage = await otherContext.newPage();
  await signUp(otherPage, "Noa Cohen");
  await otherPage.goto("/dashboard");

  await expect(progress(otherPage).getByText(/No budget set for/)).toBeVisible();
  await expect(progress(otherPage).getByText("Monthly budget", { exact: true })).toHaveCount(0);
  await otherContext.close();
});
