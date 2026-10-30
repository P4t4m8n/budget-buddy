import { expect, type Locator, type Page } from "@playwright/test";
import {
  cardValue,
  categoriesOf,
  closeDatabase,
  day,
  deleteE2eUsers,
  expectAmount,
  expectReadable,
  findUser,
  hideNextDevIndicator,
  markWishlistRowPurchased,
  removeCategoryRow,
  removeWishlistRow,
  seedBudget,
  seedCategory,
  seedTransaction,
  seedWishlistItem,
  signUp,
  test,
  thisMonth,
  transactionsOf,
  wishlistOf,
  type GoogleGrant,
} from "./helpers";

test.afterEach(deleteE2eUsers);
test.afterAll(closeDatabase);

const dialog = (page: Page) => page.getByRole("dialog");
const card = (page: Page, name: string) => page.getByRole("article", { name, exact: true });
const cardNames = (page: Page) =>
  page.getByRole("article").evaluateAll((items) => items.map((item) => item.getAttribute("aria-label")));

const userIdOf = async (account: GoogleGrant) => (await findUser(account.email))!.id;

// A signed-in user with an income category and two expense categories
async function setUp(page: Page) {
  const account = await signUp(page);
  const userId = await userIdOf(account);
  return {
    userId,
    salary: await seedCategory(userId, "Salary", "INCOME", "#10b981"),
    groceries: await seedCategory(userId, "Groceries", "EXPENSE", "#f59e0b"),
    home: await seedCategory(userId, "Home", "EXPENSE", "#6366f1"),
  };
}

// Skips the browser's own checks so the server's validation messages can be reached
const skipBrowserValidation = (page: Page) =>
  dialog(page).locator("form").evaluate((form: HTMLFormElement) => {
    form.noValidate = true;
  });

const choose = async (page: Page, select: Locator, option: string) => {
  await select.click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

const openAdd = (page: Page) => page.getByRole("button", { name: "Add item" }).click();

test.describe("the list", () => {
  test("is only for signed-in users", async ({ page }) => {
    await page.goto("/wishlist");

    await expect(page).toHaveURL(/\/login$/);
  });

  test("invites a new user to add something", async ({ page }) => {
    await setUp(page);
    await page.goto("/wishlist");

    await expect(page.getByText("Nothing on your wishlist yet.")).toBeVisible();
    await expectAmount(cardValue(page, "Still to buy"), "0 ₪");
    await expectAmount(cardValue(page, "Items on the list"), "0");
    await expectAmount(cardValue(page, "Already purchased"), "0 ₪");
    await expect(page.getByRole("heading", { name: "Purchased" })).toHaveCount(0);
    await expect(page.getByRole("article")).toHaveCount(0);
  });

  test("lists open items by priority, then name, and shows purchased ones apart", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedWishlistItem(userId, { name: "Espresso machine", priority: "LOW", price: 450 });
    await seedWishlistItem(userId, { name: "Monitor", priority: "MEDIUM", status: "SAVING", price: "520.50" });
    await seedWishlistItem(userId, { name: "Keyboard", priority: "MEDIUM", price: 180 });
    await seedWishlistItem(userId, { name: "Headphones", priority: "HIGH", price: 350, notes: "Waiting for a sale" });
    await seedWishlistItem(userId, { name: "Shoes", status: "PURCHASED", price: 140 });
    await seedWishlistItem(userId, { name: "Backpack", status: "PURCHASED", price: 90 });

    await page.goto("/wishlist");

    await expect.poll(() => cardNames(page)).toEqual(["Headphones", "Keyboard", "Monitor", "Espresso machine", "Backpack", "Shoes"]);
    await expectReadable(card(page, "Monitor"), "520.50 ₪");
    await expect(card(page, "Monitor")).toContainText("Saving for it");
    await expect(card(page, "Monitor")).toContainText("Medium");
    await expect(card(page, "Headphones")).toContainText("High");
    await expect(card(page, "Headphones")).toContainText("Waiting for a sale");
    await expect(card(page, "Keyboard")).toContainText("Wanted");
    await expect(card(page, "Shoes")).toContainText("Purchased");
    await expect(page.getByRole("heading", { name: "To buy" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Purchased" })).toBeVisible();

    await expectAmount(cardValue(page, "Still to buy"), "1,500.50 ₪");
    await expectAmount(cardValue(page, "Items on the list"), "4");
    await expectAmount(cardValue(page, "Already purchased"), "230 ₪");
  });

  test("offers purchased items nothing but Delete", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedWishlistItem(userId, { name: "Shoes", status: "PURCHASED" });
    await seedWishlistItem(userId, { name: "Desk" });
    await page.goto("/wishlist");

    await expect(card(page, "Shoes").getByRole("button")).toHaveText(["Delete"]);
    await expect(card(page, "Desk").getByRole("button")).toHaveText(["Mark purchased", "Edit", "Delete"]);
  });

  test("shows the product link, opening in a new tab without access to this one", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedWishlistItem(userId, { name: "Keyboard", url: "https://example.com/keyboard" });
    await seedWishlistItem(userId, { name: "Desk" });
    await page.goto("/wishlist");

    const link = card(page, "Keyboard").getByRole("link", { name: "View product" });
    await expect(link).toHaveAttribute("href", "https://example.com/keyboard");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(card(page, "Desk").getByRole("link")).toHaveCount(0);
  });

  test("each user only sees their own wishlist", async ({ page, browser }) => {
    const { userId } = await setUp(page);
    await seedWishlistItem(userId, { name: "Desk" });
    await page.goto("/wishlist");
    await expect(card(page, "Desk")).toBeVisible();

    const otherContext = await browser.newContext({ baseURL: "http://localhost:3100" });
    await hideNextDevIndicator(otherContext);
    const otherPage = await otherContext.newPage();
    await signUp(otherPage, "Noa Cohen");
    await otherPage.goto("/wishlist");

    await expect(otherPage.getByText("Nothing on your wishlist yet.")).toBeVisible();
    await expect(otherPage.getByRole("article")).toHaveCount(0);
    await otherContext.close();
  });
});

test.describe("adding an item", () => {
  test("adds an item with every field", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/wishlist");

    await openAdd(page);
    await expect(dialog(page).getByRole("heading", { name: "Add wishlist item" })).toBeVisible();
    await dialog(page).getByLabel("Name").fill("  Standing desk ");
    await dialog(page).getByLabel(/Price/).fill("620.5");
    await choose(page, dialog(page).getByRole("combobox", { name: "Priority" }), "High");
    await choose(page, dialog(page).getByRole("combobox", { name: "Status" }), "Saving for it");
    await dialog(page).getByLabel("Link").fill("https://example.com/desk");
    await dialog(page).getByLabel("Notes").fill("Oak top");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Standing desk")).toContainText("Saving for it");
    await expectReadable(card(page, "Standing desk"), "620.50 ₪");
    await expectAmount(cardValue(page, "Still to buy"), "620.50 ₪");
    await expectAmount(cardValue(page, "Items on the list"), "1");
    expect(await wishlistOf(userId)).toMatchObject([
      {
        name: "Standing desk",
        price: "620.50",
        currency: "ILS",
        priority: "HIGH",
        status: "SAVING",
        url: "https://example.com/desk",
        notes: "Oak top",
      },
    ]);
  });

  test("needs only a name and a price: priority is Medium and status Wanted by default", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/wishlist");

    await openAdd(page);
    await dialog(page).getByLabel("Name").fill("Keyboard");
    await dialog(page).getByLabel(/Price/).fill("180");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    expect(await wishlistOf(userId)).toMatchObject([
      { name: "Keyboard", priority: "MEDIUM", status: "WANTED", url: null, notes: null },
    ]);
  });

  test("keeps the item after a reload", async ({ page }) => {
    await setUp(page);
    await page.goto("/wishlist");
    await openAdd(page);
    await dialog(page).getByLabel("Name").fill("Keyboard");
    await dialog(page).getByLabel(/Price/).fill("180");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(card(page, "Keyboard")).toBeVisible();

    await page.reload();

    await expect(card(page, "Keyboard")).toBeVisible();
  });

  test("only offers Wanted and Saving: Purchased comes with recording the expense", async ({ page }) => {
    await setUp(page);
    await page.goto("/wishlist");
    await openAdd(page);

    await dialog(page).getByRole("combobox", { name: "Status" }).click();

    await expect(page.getByRole("option")).toHaveText(["Wanted", "Saving for it"]);
  });

  test("every opening of the form starts fresh, and cancelling saves nothing", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/wishlist");
    await openAdd(page);
    await dialog(page).getByLabel("Name").fill("Half typed");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);

    await openAdd(page);

    await expect(dialog(page).getByLabel("Name")).toHaveValue("");
    expect(await wishlistOf(userId)).toEqual([]);
  });

  test("the browser stops an empty name before it reaches the server", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/wishlist");
    await openAdd(page);
    await dialog(page).getByLabel(/Price/).fill("10");

    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByLabel("Name")).toBeFocused();
    expect(await wishlistOf(userId)).toEqual([]);
  });

  test("shows the server's validation errors next to the fields and keeps what was typed", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/wishlist");
    await openAdd(page);
    await skipBrowserValidation(page);

    await dialog(page).getByLabel("Name").fill("   ");
    await choose(page, dialog(page).getByRole("combobox", { name: "Priority" }), "High");
    await choose(page, dialog(page).getByRole("combobox", { name: "Status" }), "Saving for it");
    await dialog(page).getByLabel(/Price/).fill("0");
    await dialog(page).getByLabel("Link").fill("javascript:alert(1)");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByText("Enter a name")).toBeVisible();
    await expect(dialog(page).getByText("Amount must be greater than zero")).toBeVisible();
    await expect(dialog(page).getByText("Enter a link starting with http:// or https://")).toBeVisible();
    await expect(dialog(page).getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog(page).getByLabel(/Price/)).toHaveValue("0");
    await expect(dialog(page).getByLabel("Link")).toHaveValue("javascript:alert(1)");
    await expect(dialog(page).getByRole("combobox", { name: "Priority" })).toHaveText("High");
    await expect(dialog(page).getByRole("combobox", { name: "Status" })).toHaveText("Saving for it");
    expect(await wishlistOf(userId)).toEqual([]);

    await dialog(page).getByLabel("Name").fill("Keyboard");
    await dialog(page).getByLabel(/Price/).fill("1.234");
    await dialog(page).getByLabel("Link").fill("");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page).getByText("Enter an amount like 12.50")).toBeVisible();

    await dialog(page).getByLabel(/Price/).fill("1.23");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(card(page, "Keyboard"), "1.23 ₪");
  });
});

test.describe("editing an item", () => {
  test("shows the item's values and saves the changes", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedWishlistItem(userId, {
      name: "Desk",
      price: 600,
      priority: "LOW",
      url: "https://example.com/desk",
      notes: "Oak",
    });
    await page.goto("/wishlist");

    await page.getByRole("button", { name: "Edit Desk" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Edit wishlist item" })).toBeVisible();
    await expect(dialog(page).getByLabel("Name")).toHaveValue("Desk");
    await expect(dialog(page).getByLabel(/Price/)).toHaveValue("600");
    await expect(dialog(page).getByRole("combobox", { name: "Priority" })).toHaveText("Low");
    await expect(dialog(page).getByRole("combobox", { name: "Status" })).toHaveText("Wanted");
    await expect(dialog(page).getByLabel("Link")).toHaveValue("https://example.com/desk");
    await expect(dialog(page).getByLabel("Notes")).toHaveValue("Oak");

    await dialog(page).getByLabel("Name").fill("Standing desk");
    await dialog(page).getByLabel(/Price/).fill("650.25");
    await choose(page, dialog(page).getByRole("combobox", { name: "Priority" }), "High");
    await choose(page, dialog(page).getByRole("combobox", { name: "Status" }), "Saving for it");
    await dialog(page).getByLabel("Link").fill("");
    await dialog(page).getByLabel("Notes").fill("");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Desk")).toHaveCount(0);
    await expectReadable(card(page, "Standing desk"), "650.25 ₪");
    await expect(card(page, "Standing desk")).toContainText("Saving for it");
    await expect(card(page, "Standing desk").getByRole("link")).toHaveCount(0);
    expect(await wishlistOf(userId)).toMatchObject([
      { name: "Standing desk", price: "650.25", priority: "HIGH", status: "SAVING", url: null, notes: null },
    ]);
  });

  test("re-sorts the list when the priority changes", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedWishlistItem(userId, { name: "Alpha", priority: "HIGH" });
    await seedWishlistItem(userId, { name: "Beta", priority: "LOW" });
    await page.goto("/wishlist");
    await expect.poll(() => cardNames(page)).toEqual(["Alpha", "Beta"]);

    await page.getByRole("button", { name: "Edit Beta" }).click();
    await choose(page, dialog(page).getByRole("combobox", { name: "Priority" }), "High");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(() => cardNames(page)).toEqual(["Alpha", "Beta"]);
    await page.getByRole("button", { name: "Edit Alpha" }).click();
    await choose(page, dialog(page).getByRole("combobox", { name: "Priority" }), "Low");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect.poll(() => cardNames(page)).toEqual(["Beta", "Alpha"]);
  });

  test("leaves the item unchanged when cancelled", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedWishlistItem(userId, { name: "Desk", price: 600 });
    await page.goto("/wishlist");
    await page.getByRole("button", { name: "Edit Desk" }).click();
    await dialog(page).getByLabel("Name").fill("Changed");

    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Desk")).toBeVisible();
    expect(await wishlistOf(userId)).toMatchObject([{ name: "Desk", price: "600.00" }]);
  });

  test("says so when the item was deleted elsewhere, then refreshes the list", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedWishlistItem(userId, { name: "Desk" });
    await page.goto("/wishlist");
    await page.getByRole("button", { name: "Edit Desk" }).click();
    await removeWishlistRow(id);

    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Desk")).toHaveCount(0);
  });

  test("says so when the item was purchased elsewhere, then shows it as purchased", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedWishlistItem(userId, { name: "Desk", price: 600 });
    await page.goto("/wishlist");
    await page.getByRole("button", { name: "Edit Desk" }).click();
    await dialog(page).getByLabel(/Price/).fill("1");
    await markWishlistRowPurchased(id);

    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("A purchased item can't be changed");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Desk").getByRole("button")).toHaveText(["Delete"]);
    expect(await wishlistOf(userId)).toMatchObject([{ price: "600.00", status: "PURCHASED" }]);
  });
});

test.describe("marking an item purchased", () => {
  test("records the expense with the item's name and price, and moves the item to Purchased", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    await seedWishlistItem(userId, { name: "Desk", price: "620.50" });
    await seedWishlistItem(userId, { name: "Keyboard", price: 180 });
    await page.goto("/wishlist");

    await page.getByRole("button", { name: "Mark Desk as purchased" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Mark as purchased" })).toBeVisible();
    await expect(dialog(page)).toContainText("Desk");
    await expectReadable(dialog(page), "620.50 ₪");
    await choose(page, dialog(page).getByRole("combobox", { name: "Category" }), "Groceries");
    await dialog(page).getByLabel("Date").fill("2026-10-20");
    await dialog(page).getByRole("button", { name: "Mark purchased" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Desk").getByRole("button")).toHaveText(["Delete"]);
    await expect.poll(() => cardNames(page)).toEqual(["Keyboard", "Desk"]);
    await expectAmount(cardValue(page, "Still to buy"), "180 ₪");
    await expectAmount(cardValue(page, "Items on the list"), "1");
    await expectAmount(cardValue(page, "Already purchased"), "620.50 ₪");

    expect(await wishlistOf(userId)).toMatchObject([
      { name: "Desk", status: "PURCHASED" },
      { name: "Keyboard", status: "WANTED" },
    ]);
    expect(await transactionsOf(userId)).toMatchObject([
      {
        description: "Desk",
        amount: "620.50",
        currency: "ILS",
        type: "EXPENSE",
        categoryId: groceries,
        date: "2026-10-20",
      },
    ]);
  });

  test("offers today's date, and only expense categories", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedWishlistItem(userId, { name: "Desk" });
    await page.goto("/wishlist");

    await page.getByRole("button", { name: "Mark Desk as purchased" }).click();

    const today = await page.evaluate(() => new Date().toLocaleDateString("en-CA"));
    await expect(dialog(page).getByLabel("Date")).toHaveValue(today);
    await dialog(page).getByRole("combobox", { name: "Category" }).click();
    await expect(page.getByRole("option")).toHaveText(["Groceries", "Home"]);
  });

  test("the new expense shows up on the transactions page and in the month's budget", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    const month = thisMonth();
    await seedBudget(userId, groceries, month, 1000);
    await seedWishlistItem(userId, { name: "Desk", price: 400 });
    await page.goto("/budget");
    await expectReadable(page.getByRole("listitem", { name: "Groceries", exact: true }), "0 ₪ / 1,000 ₪");
    await page.locator("aside").getByRole("link", { name: "Wishlist" }).click();

    await page.getByRole("button", { name: "Mark Desk as purchased" }).click();
    await choose(page, dialog(page).getByRole("combobox", { name: "Category" }), "Groceries");
    await dialog(page).getByLabel("Date").fill(day(month, 1));
    await dialog(page).getByRole("button", { name: "Mark purchased" }).click();
    await expect(dialog(page)).toHaveCount(0);

    await page.locator("aside").getByRole("link", { name: "Transactions" }).click();
    await expect(page.locator(".MuiDataGrid-row").filter({ hasText: "Desk" })).toBeVisible();

    await page.locator("aside").getByRole("link", { name: "Budget", exact: true }).click();
    await expectReadable(page.getByRole("listitem", { name: "Groceries", exact: true }), "400 ₪ / 1,000 ₪");
  });

  test("keeps everything as it was when cancelled", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedWishlistItem(userId, { name: "Desk" });
    await page.goto("/wishlist");
    await page.getByRole("button", { name: "Mark Desk as purchased" }).click();
    await choose(page, dialog(page).getByRole("combobox", { name: "Category" }), "Groceries");

    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(dialog(page)).toHaveCount(0);
    expect(await wishlistOf(userId)).toMatchObject([{ status: "WANTED" }]);
    expect(await transactionsOf(userId)).toEqual([]);
  });

  test("needs a category", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedWishlistItem(userId, { name: "Desk" });
    await page.goto("/wishlist");
    await page.getByRole("button", { name: "Mark Desk as purchased" }).click();
    await skipBrowserValidation(page);

    await dialog(page).getByRole("button", { name: "Mark purchased" }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("Choose a category");
    await expect(dialog(page).getByRole("combobox", { name: "Category" })).toHaveText("Select a category");
    expect(await wishlistOf(userId)).toMatchObject([{ status: "WANTED" }]);
    expect(await transactionsOf(userId)).toEqual([]);
  });

  test("sends a user without expense categories to create one", async ({ page }) => {
    const account = await signUp(page);
    const userId = await userIdOf(account);
    await seedCategory(userId, "Salary", "INCOME");
    await seedWishlistItem(userId, { name: "Desk" });
    await page.goto("/wishlist");

    await page.getByRole("button", { name: "Mark Desk as purchased" }).click();

    await expect(dialog(page)).toContainText("You have no expense categories yet.");
    await expect(dialog(page).getByRole("button", { name: "Mark purchased" })).toBeDisabled();
    await dialog(page).getByRole("link", { name: "Create one on the Categories page." }).click();
    await expect(page).toHaveURL(/\/categories$/);
  });

  test("says so when it was already purchased elsewhere, records nothing more, then refreshes", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedWishlistItem(userId, { name: "Desk" });
    await page.goto("/wishlist");
    await page.getByRole("button", { name: "Mark Desk as purchased" }).click();
    await choose(page, dialog(page).getByRole("combobox", { name: "Category" }), "Groceries");
    await markWishlistRowPurchased(id);

    await dialog(page).getByRole("button", { name: "Mark purchased" }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("already marked as purchased");
    expect(await transactionsOf(userId)).toEqual([]);
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Desk").getByRole("button")).toHaveText(["Delete"]);
  });

  test("says so when the item was deleted elsewhere, then refreshes", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedWishlistItem(userId, { name: "Desk" });
    await page.goto("/wishlist");
    await page.getByRole("button", { name: "Mark Desk as purchased" }).click();
    await choose(page, dialog(page).getByRole("combobox", { name: "Category" }), "Groceries");
    await removeWishlistRow(id);

    await dialog(page).getByRole("button", { name: "Mark purchased" }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
    expect(await transactionsOf(userId)).toEqual([]);
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(card(page, "Desk")).toHaveCount(0);
  });

  test("says so when the category was deleted elsewhere, and the item stays wanted", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    await seedWishlistItem(userId, { name: "Desk" });
    await page.goto("/wishlist");
    await page.getByRole("button", { name: "Mark Desk as purchased" }).click();
    await choose(page, dialog(page).getByRole("combobox", { name: "Category" }), "Groceries");
    await removeCategoryRow(groceries);

    await dialog(page).getByRole("button", { name: "Mark purchased" }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("Choose one of your expense categories");
    expect(await wishlistOf(userId)).toMatchObject([{ status: "WANTED" }]);
    expect(await transactionsOf(userId)).toEqual([]);
    expect((await categoriesOf(userId)).map((c) => c.name)).not.toContain("Groceries");
  });
});

test.describe("deleting an item", () => {
  test("asks first, then removes the item", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedWishlistItem(userId, { name: "Desk" });
    await seedWishlistItem(userId, { name: "Keyboard" });
    await page.goto("/wishlist");

    await page.getByRole("button", { name: "Delete Desk" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Delete item?" })).toBeVisible();
    await expect(dialog(page)).toContainText("“Desk” will be removed from your wishlist.");
    await expect(dialog(page)).not.toContainText("expense recorded");

    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(() => cardNames(page)).toEqual(["Keyboard"]);
    await expectAmount(cardValue(page, "Items on the list"), "1");
    expect((await wishlistOf(userId)).map((i) => i.name)).toEqual(["Keyboard"]);
  });

  test("keeps the item when cancelled", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedWishlistItem(userId, { name: "Desk" });
    await page.goto("/wishlist");

    await page.getByRole("button", { name: "Delete Desk" }).click();
    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Desk")).toBeVisible();
    expect(await wishlistOf(userId)).toHaveLength(1);
  });

  test("a purchased item can be deleted, and its expense stays", async ({ page }) => {
    const { userId, groceries } = await setUp(page);
    await seedWishlistItem(userId, { name: "Shoes", status: "PURCHASED", price: 140 });
    await seedTransaction(userId, groceries, { description: "Shoes", amount: 140, date: day(thisMonth(), 3) });
    await page.goto("/wishlist");

    await page.getByRole("button", { name: "Delete Shoes" }).click();
    await expect(dialog(page)).toContainText("The expense recorded for it stays in your transactions.");
    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Shoes")).toHaveCount(0);
    expect(await wishlistOf(userId)).toEqual([]);
    expect(await transactionsOf(userId)).toHaveLength(1);
  });

  test("says so when it was already deleted elsewhere, then refreshes the list", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedWishlistItem(userId, { name: "Desk" });
    await page.goto("/wishlist");
    await page.getByRole("button", { name: "Delete Desk" }).click();
    await removeWishlistRow(id);

    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Desk")).toHaveCount(0);
  });
});
