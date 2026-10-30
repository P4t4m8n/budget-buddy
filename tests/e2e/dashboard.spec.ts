import { expect, type Locator, type Page } from "@playwright/test";
import { APP_TIME_ZONE } from "../../lib/constants";
import { addMonths, currentMonth } from "../../lib/dates";
import {
  closeDatabase,
  deleteE2eUsers,
  findUser,
  hideNextDevIndicator,
  seedCategory,
  seedTransaction,
  signUp,
  test,
  type GoogleGrant,
} from "./helpers";

test.afterEach(deleteE2eUsers);
test.afterAll(closeDatabase);

const userIdOf = async (account: GoogleGrant) => (await findUser(account.email))!.id;

// The page works out "this month" itself; the tests ask the same helper, so they agree
const thisMonth = () => currentMonth(new Date(), APP_TIME_ZONE);
const day = (month: string, dayOfMonth: number) =>
  `${month}-${String(dayOfMonth).padStart(2, "0")}`;

const cardValue = (page: Page, label: string) =>
  page
    .getByText(label, { exact: true })
    .locator("xpath=following-sibling::p[1]");

const recentList = (page: Page) =>
  page.getByRole("heading", { name: "Recent transactions" }).locator("xpath=following-sibling::ul/li");

// The Hebrew currency format wraps amounts in invisible direction marks and uses no-break
// spaces; compare what the user reads
const readable = (text: string | null) =>
  (text ?? "").replace(/[\u200e\u200f]/g, "").replace(/\u00a0/g, " ");

const expectReadable = (locator: Locator, expected: string) =>
  expect.poll(async () => readable(await locator.textContent())).toContain(expected);

const expectAmount = (locator: Locator, expected: string) =>
  expect.poll(async () => readable(await locator.textContent())).toBe(expected);

// A signed-in user with an expense category and an income category
async function setUp(page: Page) {
  const account = await signUp(page);
  const userId = await userIdOf(account);
  return {
    userId,
    salary: await seedCategory(userId, "Salary", "INCOME"),
    groceries: await seedCategory(userId, "Groceries", "EXPENSE", "#f59e0b"),
    rent: await seedCategory(userId, "Rent", "EXPENSE", "#6366f1"),
  };
}

test("is only for signed-in users", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login$/);
});

test("guides a new user who has no data yet", async ({ page }) => {
  await signUp(page);
  await page.goto("/dashboard");

  await expectAmount(cardValue(page, "Balance"), "0 ₪");
  await expectAmount(cardValue(page, "Income this month"), "0 ₪");
  await expectAmount(cardValue(page, "Spending this month"), "0 ₪");
  await expect(page.getByText("No spending recorded this month.")).toBeVisible();
  await expect(page.getByText(/Nothing in the last 6 months yet/)).toBeVisible();
  await expect(page.getByText("No transactions yet.")).toBeVisible();

  await page.getByRole("link", { name: "Add your first one on the Transactions page." }).click();
  await expect(page).toHaveURL(/\/transactions$/);
});

test("shows the numbers computed from the user's own transactions", async ({ page }) => {
  const { userId, salary, groceries, rent } = await setUp(page);
  const month = thisMonth();
  const lastMonth = addMonths(month, -1);
  await seedTransaction(userId, salary, { description: "Pay", amount: 7200, date: day(month, 1), type: "INCOME" });
  await seedTransaction(userId, rent, { description: "Rent", amount: 2400, date: day(month, 2) });
  await seedTransaction(userId, groceries, { description: "Supermarket", amount: "430.25", date: day(month, 3) });
  await seedTransaction(userId, salary, { description: "Old pay", amount: 7000, date: day(lastMonth, 1), type: "INCOME" });
  await seedTransaction(userId, rent, { description: "Old rent", amount: 2400, date: day(lastMonth, 2) });

  await page.goto("/dashboard");

  await expect(page.getByText(/^This month: [A-Z][a-z]+ \d{4}$/)).toBeVisible();
  await expectReadable(cardValue(page, "Income this month"), "7,200 ₪");
  await expectReadable(cardValue(page, "Spending this month"), "2,830.25 ₪");
  // 7200 + 7000 - 2400 - 430.25 - 2400
  await expectAmount(cardValue(page, "Balance"), "8,969.75 ₪");
});

test("lists the newest transactions with their category names", async ({ page }) => {
  const { userId, groceries, salary } = await setUp(page);
  const month = thisMonth();
  await seedTransaction(userId, groceries, { description: "Supermarket", amount: "430.25", date: day(month, 5) });
  await seedTransaction(userId, salary, { description: "Pay", amount: 7200, date: day(month, 1), type: "INCOME" });

  await page.goto("/dashboard");

  const recent = recentList(page);
  await expect(recent).toHaveCount(2);
  await expect(recent.nth(0)).toContainText("Supermarket");
  await expect(recent.nth(0)).toContainText(`Groceries · ${day(month, 5)}`);
  await expectReadable(recent.nth(0), "-430.25 ₪");
  await expect(recent.nth(1)).toContainText("Pay");
  await expect(recent.nth(1)).toContainText("Salary");
  await expectReadable(recent.nth(1), "+7,200 ₪");
});

test("shows only the six newest recent transactions", async ({ page }) => {
  const { userId, groceries } = await setUp(page);
  const month = thisMonth();
  for (let d = 1; d <= 8; d++) {
    await seedTransaction(userId, groceries, { description: `Purchase ${d}`, amount: d, date: day(month, d) });
  }

  await page.goto("/dashboard");

  const recent = recentList(page);
  await expect(recent).toHaveCount(6);
  await expect(recent.first()).toContainText("Purchase 8");
  await expect(recent.last()).toContainText("Purchase 3");
});

test("draws the spending chart with this month's categories", async ({ page }) => {
  const { userId, groceries, rent, salary } = await setUp(page);
  const month = thisMonth();
  await seedTransaction(userId, rent, { description: "Rent", amount: 2400, date: day(month, 2) });
  await seedTransaction(userId, groceries, { description: "Shop", amount: 300, date: day(month, 3) });
  await seedTransaction(userId, salary, { description: "Pay", amount: 7200, date: day(month, 1), type: "INCOME" });

  await page.goto("/dashboard");

  const panel = page.locator("div").filter({ has: page.getByRole("heading", { name: "Spending by category" }) }).last();
  await expect(panel.locator("svg").first()).toBeVisible();
  await expect(panel.getByText("Rent")).toBeVisible();
  await expect(panel.getByText("Groceries")).toBeVisible();
  // Each slice is drawn in its category's own color
  await expect(panel.locator('path[fill="#6366f1"]')).toHaveCount(1);
  await expect(panel.locator('path[fill="#f59e0b"]')).toHaveCount(1);
  // Income is not spending
  await expect(panel.getByText("Salary")).toHaveCount(0);
  await expect(page.getByText("No spending recorded this month.")).toHaveCount(0);
});

test("draws the income vs. expenses chart over six months", async ({ page }) => {
  const { userId, groceries, salary } = await setUp(page);
  const month = thisMonth();
  await seedTransaction(userId, salary, { description: "Pay", amount: 7200, date: day(addMonths(month, -2), 1), type: "INCOME" });
  await seedTransaction(userId, groceries, { description: "Shop", amount: 300, date: day(month, 3) });

  await page.goto("/dashboard");

  const panel = page.locator("div").filter({ has: page.getByRole("heading", { name: "Income vs. expenses" }) }).last();
  await expect(panel.locator("svg").first()).toBeVisible();
  await expect(panel.getByText("Income", { exact: true })).toBeVisible();
  await expect(panel.getByText("Expenses", { exact: true })).toBeVisible();
  await expect(panel.getByText(addMonths(month, -5))).toBeVisible();
  await expect(panel.getByText(month)).toBeVisible();
  await expect(page.getByText(/Nothing in the last 6 months yet/)).toHaveCount(0);
});

test("a transaction added on the transactions page shows up on the dashboard", async ({ page }) => {
  await setUp(page);
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Add transaction" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill("Fresh coffee");
  await dialog.getByLabel("Amount").fill("12.5");
  await dialog.getByRole("combobox", { name: /Category/ }).click();
  await page.getByRole("option", { name: "Groceries", exact: true }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);

  await page.locator("aside").getByRole("link", { name: "Dashboard" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expectReadable(cardValue(page, "Spending this month"), "12.50 ₪");
  await expectAmount(cardValue(page, "Balance"), "-12.50 ₪");
  // Scoped to the recent list: the transactions page stays mounted in the background
  await expect(recentList(page).filter({ hasText: "Fresh coffee" })).toHaveCount(1);
});

test("a negative balance is shown in red", async ({ page }) => {
  const { userId, groceries } = await setUp(page);
  await seedTransaction(userId, groceries, { description: "Shop", amount: 100, date: day(thisMonth(), 2) });

  await page.goto("/dashboard");

  await expect(cardValue(page, "Balance")).toHaveClass(/text-red-400/);
});

test("each user only sees their own numbers", async ({ page, browser }) => {
  const { userId, groceries } = await setUp(page);
  await seedTransaction(userId, groceries, { description: "Dana's private purchase", amount: 5000, date: day(thisMonth(), 2) });
  await page.goto("/dashboard");
  await expect(recentList(page).filter({ hasText: "Dana's private purchase" })).toHaveCount(1);

  const otherContext = await browser.newContext({ baseURL: "http://localhost:3100" });
  await hideNextDevIndicator(otherContext);
  const otherPage = await otherContext.newPage();
  await signUp(otherPage, "Noa Cohen");
  await otherPage.goto("/dashboard");

  await expect(otherPage.getByText("Dana's private purchase")).toHaveCount(0);
  await expectAmount(cardValue(otherPage, "Spending this month"), "0 ₪");
  await expectAmount(cardValue(otherPage, "Balance"), "0 ₪");
  await otherContext.close();
});

test("no longer shows the mock data", async ({ page }) => {
  await signUp(page);
  await page.goto("/dashboard");

  await expect(page.getByText("Total saved")).toHaveCount(0);
  await expect(page.getByText("19,500")).toHaveCount(0);
});
