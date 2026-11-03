import { expect, type Locator, type Page } from "@playwright/test";
import {
  cardValue,
  closeDatabase,
  deleteE2eUsers,
  expectAmount,
  expectReadable,
  findUser,
  hideNextDevIndicator,
  investmentsOf,
  removeInvestmentRow,
  seedInvestment,
  seedSnapshot,
  signUp,
  snapshotsOf,
  test,
  today,
  type GoogleGrant,
} from "./helpers";

test.afterEach(deleteE2eUsers);
test.afterAll(closeDatabase);

const dialog = (page: Page) => page.getByRole("dialog");
const rows = (page: Page) => page.locator(".MuiDataGrid-row");
const row = (page: Page, name: string) => rows(page).filter({ has: page.locator('[data-field="name"]', { hasText: name }) });
const cell = (page: Page, name: string, field: string) => row(page, name).locator(`[data-field="${field}"]`);
const rowNames = (page: Page) => rows(page).locator('[data-field="name"]').allTextContents();
const panel = (page: Page, heading: string) =>
  page.locator("div").filter({ has: page.getByRole("heading", { name: heading }) }).last();

const userIdOf = async (account: GoogleGrant) => (await findUser(account.email))!.id;

async function setUp(page: Page) {
  const account = await signUp(page);
  return { userId: await userIdOf(account) };
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

const openAdd = (page: Page) => page.getByRole("button", { name: "Add investment" }).click();

async function fillAdd(
  page: Page,
  { name, type, ticker, invested, value, date }: { name: string; type?: string; ticker?: string; invested: string; value: string; date: string },
) {
  await dialog(page).getByLabel("Name").fill(name);
  if (type) await choose(page, dialog(page).getByRole("combobox", { name: "Type" }), type);
  if (ticker) await dialog(page).getByLabel(/Ticker/).fill(ticker);
  await dialog(page).getByLabel(/Amount invested/).fill(invested);
  await dialog(page).getByLabel(/Current value/).fill(value);
  await dialog(page).getByLabel("Purchase date").fill(date);
}

test.describe("the list", () => {
  test("invites a new user to add an investment", async ({ page }) => {
    await setUp(page);
    await page.goto("/savings");

    await expect(page.getByText("No investments yet")).toBeVisible();
    await expect(page.getByText("Add an investment to compare what you put in with what it is worth.")).toBeVisible();
    await expect(page.getByText("Update an investment's value to build its history.")).toBeVisible();
    await expectAmount(cardValue(page, "Total invested"), "0 ₪");
    await expectAmount(cardValue(page, "Portfolio value"), "0 ₪");
    await expectAmount(cardValue(page, "Total return"), "+0 ₪");
  });

  test("shows each investment's details, return and values, by name", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedInvestment(userId, { name: "World ETF", type: "ETF", ticker: "VWRL", invested: 5000, value: "5420.50" });
    await seedInvestment(userId, { name: "Apple stock", type: "STOCK", ticker: "AAPL", invested: 2000, value: 2480 });
    await seedInvestment(userId, { name: "Gov bonds", type: "BOND", invested: 3000, value: 3090 });
    await seedInvestment(userId, { name: "Bitcoin", type: "CRYPTO", ticker: "BTC", invested: 1500, value: 1320 });

    await page.goto("/savings");

    await expect.poll(() => rowNames(page)).toEqual(["Apple stock", "Bitcoin", "Gov bonds", "World ETF"]);
    await expect(cell(page, "World ETF", "ticker")).toHaveText("VWRL");
    await expect(cell(page, "World ETF", "type")).toHaveText("ETF");
    await expectReadable(cell(page, "World ETF", "amountInvested"), "5,000 ₪");
    await expectReadable(cell(page, "World ETF", "currentValue"), "5,420.50 ₪");
    await expect(cell(page, "World ETF", "gainPercent")).toHaveText("+8.4%");
    await expect(cell(page, "Apple stock", "type")).toHaveText("Stock");
    await expect(cell(page, "Bitcoin", "type")).toHaveText("Crypto");
    await expect(cell(page, "Gov bonds", "type")).toHaveText("Bond");
  });

  test("shows a dash for an investment without a ticker", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedInvestment(userId, { name: "Gov bonds", ticker: null });
    await page.goto("/savings");

    await expect(cell(page, "Gov bonds", "ticker")).toHaveText("-");
  });

  test("colours a gain green and a loss red", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedInvestment(userId, { name: "Winner", invested: 1000, value: 1100 });
    await seedInvestment(userId, { name: "Loser", invested: 1000, value: 800 });
    await seedInvestment(userId, { name: "Worthless", invested: 100, value: 0 });
    await page.goto("/savings");

    await expect(cell(page, "Winner", "gainPercent").locator("span")).toHaveClass(/text-emerald-400/);
    await expect(cell(page, "Winner", "gainPercent")).toHaveText("+10.0%");
    await expect(cell(page, "Loser", "gainPercent").locator("span")).toHaveClass(/text-red-400/);
    await expect(cell(page, "Loser", "gainPercent")).toHaveText("-20.0%");
    await expect(cell(page, "Worthless", "gainPercent")).toHaveText("-100.0%");
  });

  test("totals what was invested, what it is worth and the return", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedInvestment(userId, { name: "A", invested: "1000.05", value: "1200.15" });
    await seedInvestment(userId, { name: "B", invested: "0.20", value: "0.10" });
    await seedInvestment(userId, { name: "C", invested: "0.10", value: "0.30" });

    await page.goto("/savings");

    await expectAmount(cardValue(page, "Total invested"), "1,000.35 ₪");
    await expectAmount(cardValue(page, "Portfolio value"), "1,200.55 ₪");
    await expectAmount(cardValue(page, "Total return"), "+200.20 ₪");
    await expect(cardValue(page, "Total return")).toHaveClass(/text-emerald-400/);
  });

  test("shows a negative total return in red", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedInvestment(userId, { name: "A", invested: 1000, value: 400 });

    await page.goto("/savings");

    await expectAmount(cardValue(page, "Total return"), "-600 ₪");
    await expect(cardValue(page, "Total return")).toHaveClass(/text-red-400/);
  });

  test("draws both charts once there is an investment with a recorded value", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedInvestment(userId, { name: "World ETF" });
    await seedSnapshot(userId, id, "2026-09-01", 1000);
    await seedSnapshot(userId, id, "2026-10-01", 1100);

    await page.goto("/savings");

    const bars = panel(page, "Invested vs. current value");
    await expect(bars.locator("svg").first()).toBeVisible();
    await expect(bars.getByText("Invested", { exact: true })).toBeVisible();
    await expect(bars.getByText("Current value", { exact: true })).toBeVisible();
    const history = panel(page, "Investment value over time");
    await expect(history.locator("svg").first()).toBeVisible();
    await expect(history.getByText("World ETF", { exact: true })).toBeVisible();
    await expect(page.getByText("Update an investment's value to build its history.")).toHaveCount(0);
  });

  test("asks for a first value for the history when an investment has none yet", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedInvestment(userId, { name: "World ETF" });
    await page.goto("/savings");

    await expect(panel(page, "Invested vs. current value").locator("svg").first()).toBeVisible();
    await expect(page.getByText("Update an investment's value to build its history.")).toBeVisible();
  });

  test("each user only sees their own investments", async ({ page, browser }) => {
    const { userId } = await setUp(page);
    await seedInvestment(userId, { name: "World ETF", invested: 5000, value: 5000 });
    await page.goto("/savings");
    await expect(row(page, "World ETF")).toBeVisible();

    const otherContext = await browser.newContext({ baseURL: "http://localhost:3100" });
    await hideNextDevIndicator(otherContext);
    const otherPage = await otherContext.newPage();
    await signUp(otherPage, "Noa Cohen");
    await otherPage.goto("/savings");

    await expect(otherPage.getByText("No investments yet")).toBeVisible();
    await expectAmount(cardValue(otherPage, "Total invested"), "0 ₪");
    await otherContext.close();
  });
});

test.describe("adding an investment", () => {
  test("adds an investment, with its first value recorded for today", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/savings");

    await openAdd(page);
    await expect(dialog(page).getByRole("heading", { name: "Add investment" })).toBeVisible();
    await expect(dialog(page).getByRole("combobox", { name: "Type" })).toHaveText("Stock");
    await fillAdd(page, {
      name: "  S&P 500 ETF ",
      type: "ETF",
      ticker: "voo",
      invested: "8000.5",
      value: "9150.25",
      date: "2025-03-10",
    });
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(cell(page, "S&P 500 ETF", "ticker")).toHaveText("VOO");
    await expect(cell(page, "S&P 500 ETF", "type")).toHaveText("ETF");
    await expectReadable(cell(page, "S&P 500 ETF", "amountInvested"), "8,000.50 ₪");
    await expectReadable(cell(page, "S&P 500 ETF", "currentValue"), "9,150.25 ₪");
    await expect(cell(page, "S&P 500 ETF", "gainPercent")).toHaveText("+14.4%");
    await expectAmount(cardValue(page, "Total invested"), "8,000.50 ₪");
    await expectAmount(cardValue(page, "Portfolio value"), "9,150.25 ₪");
    const [saved] = await investmentsOf(userId);
    expect(saved).toMatchObject({
      name: "S&P 500 ETF",
      type: "ETF",
      ticker: "VOO",
      amountInvested: "8000.50",
      currentValue: "9150.25",
      currency: "ILS",
      purchaseDate: "2025-03-10",
    });
    expect(await snapshotsOf(saved.id)).toEqual([{ date: today(), value: "9150.25" }]);
    await expect(page.getByText("Update an investment's value to build its history.")).toHaveCount(0);
  });

  test("the ticker is optional", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/savings");

    await openAdd(page);
    await fillAdd(page, { name: "Gov bonds", type: "Bond", invested: "3000", value: "3090", date: "2026-02-01" });
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(cell(page, "Gov bonds", "ticker")).toHaveText("-");
    expect(await investmentsOf(userId)).toMatchObject([{ name: "Gov bonds", type: "BOND", ticker: null }]);
  });

  test("accepts an investment that is already worth nothing", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/savings");

    await openAdd(page);
    await fillAdd(page, { name: "Dead coin", type: "Crypto", invested: "100", value: "0", date: "2026-01-20" });
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(cell(page, "Dead coin", "gainPercent")).toHaveText("-100.0%");
    expect(await investmentsOf(userId)).toMatchObject([{ currentValue: "0.00" }]);
  });

  test("keeps the investment after a reload", async ({ page }) => {
    await setUp(page);
    await page.goto("/savings");
    await openAdd(page);
    await fillAdd(page, { name: "Apple stock", invested: "2000", value: "2480", date: "2024-11-05" });
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(row(page, "Apple stock")).toBeVisible();

    await page.reload();

    await expect(row(page, "Apple stock")).toBeVisible();
  });

  test("every opening of the form starts fresh, and cancelling saves nothing", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/savings");
    await openAdd(page);
    await dialog(page).getByLabel("Name").fill("Half typed");
    await choose(page, dialog(page).getByRole("combobox", { name: "Type" }), "Crypto");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);

    await openAdd(page);

    await expect(dialog(page).getByLabel("Name")).toHaveValue("");
    await expect(dialog(page).getByRole("combobox", { name: "Type" })).toHaveText("Stock");
    expect(await investmentsOf(userId)).toEqual([]);
  });

  test("the browser stops a missing purchase date before it reaches the server", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/savings");
    await openAdd(page);
    await dialog(page).getByLabel("Name").fill("Apple stock");
    await dialog(page).getByLabel(/Amount invested/).fill("100");
    await dialog(page).getByLabel(/Current value/).fill("100");

    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByLabel("Purchase date")).toBeFocused();
    expect(await investmentsOf(userId)).toEqual([]);
  });

  test("shows the server's validation errors next to the fields and keeps what was typed", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/savings");
    await openAdd(page);
    await skipBrowserValidation(page);

    await dialog(page).getByLabel("Name").fill("   ");
    await choose(page, dialog(page).getByRole("combobox", { name: "Type" }), "Bond");
    await dialog(page).getByLabel(/Amount invested/).fill("0");
    await dialog(page).getByLabel(/Current value/).fill("-1");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByText("Enter a name")).toBeVisible();
    await expect(dialog(page).getByText("Amount must be greater than zero")).toBeVisible();
    await expect(dialog(page).getByText("Enter an amount like 12.50")).toBeVisible();
    await expect(dialog(page).getByText("Enter a valid date")).toBeVisible();
    await expect(dialog(page).getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog(page).getByLabel(/Amount invested/)).toHaveValue("0");
    await expect(dialog(page).getByLabel(/Current value/)).toHaveValue("-1");
    await expect(dialog(page).getByRole("combobox", { name: "Type" })).toHaveText("Bond");
    expect(await investmentsOf(userId)).toEqual([]);

    await fillAdd(page, { name: "Gov bonds", invested: "3000", value: "3090", date: "2026-02-01" });
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(cell(page, "Gov bonds", "type")).toHaveText("Bond");
  });
});

test.describe("editing an investment", () => {
  test("shows the investment's values and saves the changes, keeping its value and history", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedInvestment(userId, {
      name: "Old name",
      type: "ETF",
      ticker: "OLD",
      invested: 1000,
      value: "1500.50",
      purchaseDate: "2025-03-10",
    });
    await seedSnapshot(userId, id, "2026-10-01", "1500.50");
    await page.goto("/savings");

    await page.getByRole("button", { name: "Edit Old name" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Edit investment" })).toBeVisible();
    await expect(dialog(page).getByLabel("Name")).toHaveValue("Old name");
    await expect(dialog(page).getByRole("combobox", { name: "Type" })).toHaveText("ETF");
    await expect(dialog(page).getByLabel(/Ticker/)).toHaveValue("OLD");
    await expect(dialog(page).getByLabel(/Amount invested/)).toHaveValue("1000");
    await expect(dialog(page).getByLabel("Purchase date")).toHaveValue("2025-03-10");
    await expect(dialog(page).getByLabel(/Current value/)).toHaveCount(0);
    await expect(dialog(page)).toContainText("To change what it is worth today, use Update value.");

    await dialog(page).getByLabel("Name").fill("New name");
    await choose(page, dialog(page).getByRole("combobox", { name: "Type" }), "Stock");
    await dialog(page).getByLabel(/Ticker/).fill("");
    await dialog(page).getByLabel(/Amount invested/).fill("1200.25");
    await dialog(page).getByLabel("Purchase date").fill("2024-05-05");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(row(page, "Old name")).toHaveCount(0);
    await expect(cell(page, "New name", "type")).toHaveText("Stock");
    await expect(cell(page, "New name", "ticker")).toHaveText("-");
    await expectReadable(cell(page, "New name", "amountInvested"), "1,200.25 ₪");
    await expectReadable(cell(page, "New name", "currentValue"), "1,500.50 ₪");
    expect(await investmentsOf(userId)).toMatchObject([
      { name: "New name", type: "STOCK", ticker: null, amountInvested: "1200.25", currentValue: "1500.50", purchaseDate: "2024-05-05" },
    ]);
    expect(await snapshotsOf(id)).toEqual([{ date: "2026-10-01", value: "1500.50" }]);
  });

  test("leaves the investment unchanged when cancelled", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedInvestment(userId, { name: "World ETF" });
    await page.goto("/savings");
    await page.getByRole("button", { name: "Edit World ETF" }).click();
    await dialog(page).getByLabel("Name").fill("Changed");

    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(row(page, "World ETF")).toBeVisible();
    expect(await investmentsOf(userId)).toMatchObject([{ name: "World ETF" }]);
  });

  test("shows the server's validation error and keeps what was typed", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedInvestment(userId, { name: "World ETF", invested: 1000 });
    await page.goto("/savings");
    await page.getByRole("button", { name: "Edit World ETF" }).click();
    await skipBrowserValidation(page);

    await dialog(page).getByLabel(/Amount invested/).fill("0");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByText("Amount must be greater than zero")).toBeVisible();
    await expect(dialog(page).getByLabel(/Amount invested/)).toHaveValue("0");
    expect(await investmentsOf(userId)).toMatchObject([{ amountInvested: "1000.00" }]);
  });

  test("says so when the investment was deleted elsewhere, then refreshes the list", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedInvestment(userId, { name: "World ETF" });
    await page.goto("/savings");
    await page.getByRole("button", { name: "Edit World ETF" }).click();
    await removeInvestmentRow(id);

    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(row(page, "World ETF")).toHaveCount(0);
  });
});

test.describe("updating the value", () => {
  test("sets what it is worth now, and records it in the history for today", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedInvestment(userId, { name: "World ETF", invested: 5000, value: 5000 });
    await seedSnapshot(userId, id, "2026-09-01", 5000);
    await page.goto("/savings");

    await page.getByRole("button", { name: "Update value of World ETF" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Update value" })).toBeVisible();
    await expectReadable(dialog(page), "World ETF is currently worth 5,000 ₪");
    await expect(dialog(page).getByLabel(/Value today/)).toHaveValue("");
    await dialog(page).getByLabel(/Value today/).fill("5420.5");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(cell(page, "World ETF", "currentValue"), "5,420.50 ₪");
    await expect(cell(page, "World ETF", "gainPercent")).toHaveText("+8.4%");
    await expectAmount(cardValue(page, "Portfolio value"), "5,420.50 ₪");
    await expectAmount(cardValue(page, "Total return"), "+420.50 ₪");
    expect(await investmentsOf(userId)).toMatchObject([{ currentValue: "5420.50" }]);
    expect(await snapshotsOf(id)).toEqual([
      { date: "2026-09-01", value: "5000.00" },
      { date: today(), value: "5420.50" },
    ]);
  });

  test("replaces today's value when it is updated again, instead of adding another", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedInvestment(userId, { name: "World ETF", invested: 5000, value: 5000 });
    await page.goto("/savings");

    for (const value of ["5100", "5300"]) {
      await page.getByRole("button", { name: "Update value of World ETF" }).click();
      await dialog(page).getByLabel(/Value today/).fill(value);
      await dialog(page).getByRole("button", { name: "Save" }).click();
      await expect(dialog(page)).toHaveCount(0);
    }

    await expectReadable(cell(page, "World ETF", "currentValue"), "5,300 ₪");
    expect(await snapshotsOf(id)).toEqual([{ date: today(), value: "5300.00" }]);
  });

  test("can be set to zero", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedInvestment(userId, { name: "Dead coin", invested: 100, value: 100 });
    await page.goto("/savings");

    await page.getByRole("button", { name: "Update value of Dead coin" }).click();
    await dialog(page).getByLabel(/Value today/).fill("0");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(cell(page, "Dead coin", "gainPercent")).toHaveText("-100.0%");
    expect(await investmentsOf(userId)).toMatchObject([{ currentValue: "0.00" }]);
  });

  test("builds the history chart", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedInvestment(userId, { name: "World ETF" });
    await page.goto("/savings");
    await expect(page.getByText("Update an investment's value to build its history.")).toBeVisible();

    await page.getByRole("button", { name: "Update value of World ETF" }).click();
    await dialog(page).getByLabel(/Value today/).fill("1200");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page)).toHaveCount(0);

    const history = panel(page, "Investment value over time");
    await expect(history.locator("svg").first()).toBeVisible();
    await expect(history.getByText("World ETF", { exact: true })).toBeVisible();
    await expect(page.getByText("Update an investment's value to build its history.")).toHaveCount(0);
  });

  test("every opening of the form starts blank, and cancelling records nothing", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedInvestment(userId, { name: "World ETF" });
    await page.goto("/savings");
    await page.getByRole("button", { name: "Update value of World ETF" }).click();
    await dialog(page).getByLabel(/Value today/).fill("777");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Update value of World ETF" }).click();

    await expect(dialog(page).getByLabel(/Value today/)).toHaveValue("");
    expect(await snapshotsOf(id)).toEqual([]);
    expect(await investmentsOf(userId)).toMatchObject([{ currentValue: "1000.00" }]);
  });

  test("the browser stops an empty value before it reaches the server", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedInvestment(userId, { name: "World ETF" });
    await page.goto("/savings");
    await page.getByRole("button", { name: "Update value of World ETF" }).click();

    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByLabel(/Value today/)).toBeFocused();
    expect(await snapshotsOf(id)).toEqual([]);
  });

  test("shows the server's validation error next to the field and keeps what was typed", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedInvestment(userId, { name: "World ETF" });
    await page.goto("/savings");
    await page.getByRole("button", { name: "Update value of World ETF" }).click();
    await skipBrowserValidation(page);

    await dialog(page).getByLabel(/Value today/).fill("-5");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByText("Enter an amount like 12.50")).toBeVisible();
    await expect(dialog(page).getByLabel(/Value today/)).toHaveAttribute("aria-invalid", "true");
    await expect(dialog(page).getByLabel(/Value today/)).toHaveValue("-5");
    expect(await snapshotsOf(id)).toEqual([]);

    await dialog(page).getByLabel(/Value today/).fill("1.5");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(cell(page, "World ETF", "currentValue"), "1.50 ₪");
  });

  test("says so when the investment was deleted elsewhere, then refreshes the list", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedInvestment(userId, { name: "World ETF" });
    await page.goto("/savings");
    await page.getByRole("button", { name: "Update value of World ETF" }).click();
    await dialog(page).getByLabel(/Value today/).fill("10");
    await removeInvestmentRow(id);

    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
    expect(await snapshotsOf(id)).toEqual([]);
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(row(page, "World ETF")).toHaveCount(0);
  });
});

test.describe("deleting an investment", () => {
  test("asks first, saying how many recorded values go with it, then removes it", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedInvestment(userId, { name: "World ETF" });
    await seedInvestment(userId, { name: "Apple stock" });
    await seedSnapshot(userId, id, "2026-09-01", 1000);
    await seedSnapshot(userId, id, "2026-10-01", 1100);
    await page.goto("/savings");

    await page.getByRole("button", { name: "Delete World ETF" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Delete investment?" })).toBeVisible();
    await expect(dialog(page)).toContainText("“World ETF” will be removed, together with its 2 recorded values.");
    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(() => rowNames(page)).toEqual(["Apple stock"]);
    expect((await investmentsOf(userId)).map((i) => i.name)).toEqual(["Apple stock"]);
    expect(await snapshotsOf(id)).toEqual([]);
  });

  test("says 'value' for a single recorded value, and nothing about an empty history", async ({ page }) => {
    const { userId } = await setUp(page);
    const one = await seedInvestment(userId, { name: "One value" });
    await seedSnapshot(userId, one, "2026-09-01", 1000);
    await seedInvestment(userId, { name: "No values" });
    await page.goto("/savings");

    await page.getByRole("button", { name: "Delete One value" }).click();
    await expect(dialog(page)).toContainText("together with its 1 recorded value.");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Delete No values" }).click();
    await expect(dialog(page)).toContainText("“No values” will be removed. This can't be undone.");
    await expect(dialog(page)).not.toContainText("recorded");
  });

  test("keeps the investment when cancelled", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedInvestment(userId, { name: "World ETF" });
    await page.goto("/savings");

    await page.getByRole("button", { name: "Delete World ETF" }).click();
    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(row(page, "World ETF")).toBeVisible();
    expect(await investmentsOf(userId)).toHaveLength(1);
  });

  test("updates the totals and the empty state", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedInvestment(userId, { name: "World ETF", invested: 5000, value: 5400 });
    await page.goto("/savings");
    await expectAmount(cardValue(page, "Total invested"), "5,000 ₪");

    await page.getByRole("button", { name: "Delete World ETF" }).click();
    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByText("No investments yet")).toBeVisible();
    await expectAmount(cardValue(page, "Total invested"), "0 ₪");
    await expectAmount(cardValue(page, "Portfolio value"), "0 ₪");
  });

  test("says so when it was already deleted elsewhere, then refreshes the list", async ({ page }) => {
    const { userId } = await setUp(page);
    const id = await seedInvestment(userId, { name: "World ETF" });
    await page.goto("/savings");
    await page.getByRole("button", { name: "Delete World ETF" }).click();
    await removeInvestmentRow(id);

    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(row(page, "World ETF")).toHaveCount(0);
  });
});
