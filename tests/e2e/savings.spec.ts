import { expect, type Page } from "@playwright/test";
import {
  cardValue,
  closeDatabase,
  deleteE2eUsers,
  depositsOf,
  expectAmount,
  expectReadable,
  findUser,
  goalsOf,
  hideNextDevIndicator,
  removeDepositRow,
  removeGoalRow,
  seedDeposit,
  seedGoal,
  signUp,
  test,
  type GoogleGrant,
} from "./helpers";

test.afterEach(deleteE2eUsers);
test.afterAll(closeDatabase);

const dialog = (page: Page) => page.getByRole("dialog");
const card = (page: Page, name: string) => page.getByRole("article", { name, exact: true });
const cardNames = (page: Page) =>
  page.getByRole("article").evaluateAll((items) => items.map((item) => item.getAttribute("aria-label")));

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

const openHistory = (page: Page, goal: string) => card(page, goal).getByText(/^History \(\d+\)$/).click();
const entries = (page: Page, goal: string) => card(page, goal).getByRole("listitem");

const openAddMoney = (page: Page, goal: string) =>
  page.getByRole("button", { name: `Add or withdraw money for ${goal}` }).click();

// Fills in and submits the add / withdraw form
async function addMoney(
  page: Page,
  goal: string,
  { kind = "Deposit", amount, date, note }: { kind?: "Deposit" | "Withdrawal"; amount: string; date?: string; note?: string },
) {
  await openAddMoney(page, goal);
  await dialog(page).getByRole("button", { name: kind, exact: true }).click();
  await dialog(page).getByLabel(/Amount/).fill(amount);
  if (date) await dialog(page).getByLabel("Date").fill(date);
  if (note) await dialog(page).getByLabel("Note").fill(note);
  await dialog(page).getByRole("button", { name: "Save" }).click();
}

test.describe("the list", () => {
  test("is only for signed-in users", async ({ page }) => {
    await page.goto("/savings");

    await expect(page).toHaveURL(/\/login$/);
  });

  test("invites a new user to add a goal", async ({ page }) => {
    await setUp(page);
    await page.goto("/savings");

    await expect(page.getByText("No savings goals yet.")).toBeVisible();
    await expectAmount(cardValue(page, "Total saved"), "0 ₪");
    await expect(page.getByRole("article")).toHaveCount(0);
  });

  test("shows each goal's balance, progress and target date, by name", async ({ page }) => {
    const { userId } = await setUp(page);
    const trip = await seedGoal(userId, "Trip", 6000, "2027-04-01");
    await seedGoal(userId, "Emergency fund", 20000);
    await seedDeposit(userId, trip, 1000, "2026-09-01");
    await seedDeposit(userId, trip, "250.50", "2026-10-05");
    await seedDeposit(userId, trip, -100, "2026-10-20");

    await page.goto("/savings");

    await expect.poll(() => cardNames(page)).toEqual(["Emergency fund", "Trip"]);
    await expectReadable(card(page, "Trip"), "1,150.50 ₪ of 6,000 ₪");
    await expect(card(page, "Trip")).toContainText("19%");
    await expect(card(page, "Trip")).toContainText("Target date: 2027-04-01");
    const bar = page.getByRole("progressbar", { name: "Trip saved" });
    await expect(bar).toHaveAttribute("aria-valuemax", "6000");
    await expect(bar).toHaveAttribute("aria-valuenow", "1150.5");
    await expectReadable(card(page, "Emergency fund"), "0 ₪ of 20,000 ₪");
    await expect(card(page, "Emergency fund")).toContainText("0%");
    await expect(card(page, "Emergency fund")).toContainText("No target date");
    await expect(card(page, "Emergency fund")).toContainText("No deposits yet");
  });

  test("totals every goal in the Total saved card", async ({ page }) => {
    const { userId } = await setUp(page);
    const a = await seedGoal(userId, "A");
    const b = await seedGoal(userId, "B");
    await seedDeposit(userId, a, "100.10");
    await seedDeposit(userId, a, "0.20");
    await seedDeposit(userId, b, 500);
    await seedDeposit(userId, b, -50);

    await page.goto("/savings");

    await expectAmount(cardValue(page, "Total saved"), "550.30 ₪");
  });

  test("caps the progress at 100% for a goal that holds more than its target", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Small", 100);
    await seedDeposit(userId, goal, 250);

    await page.goto("/savings");

    await expect(card(page, "Small")).toContainText("100%");
    await expectReadable(card(page, "Small"), "250 ₪ of 100 ₪");
    await expect(page.getByRole("progressbar", { name: "Small saved" })).toHaveAttribute("aria-valuenow", "100");
  });

  test("each user only sees their own goals", async ({ page, browser }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await seedDeposit(userId, goal, 300);
    await page.goto("/savings");
    await expect(card(page, "Trip")).toBeVisible();

    const otherContext = await browser.newContext({ baseURL: "http://localhost:3100" });
    await hideNextDevIndicator(otherContext);
    const otherPage = await otherContext.newPage();
    await signUp(otherPage, "Noa Cohen");
    await otherPage.goto("/savings");

    await expect(otherPage.getByText("No savings goals yet.")).toBeVisible();
    await expectAmount(cardValue(otherPage, "Total saved"), "0 ₪");
    await otherContext.close();
  });
});

test.describe("adding a goal", () => {
  test("adds a goal with every field", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/savings");

    await page.getByRole("button", { name: "Add goal" }).click();
    await expect(dialog(page).getByRole("heading", { name: "Add savings goal" })).toBeVisible();
    await dialog(page).getByLabel("Name").fill("  Vacation in Japan ");
    await dialog(page).getByLabel(/Target amount/).fill("6000.5");
    await dialog(page).getByLabel(/Target date/).fill("2027-04-01");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(card(page, "Vacation in Japan"), "0 ₪ of 6,000.50 ₪");
    await expect(card(page, "Vacation in Japan")).toContainText("Target date: 2027-04-01");
    expect(await goalsOf(userId)).toMatchObject([
      { name: "Vacation in Japan", targetAmount: "6000.50", currency: "ILS", targetDate: "2027-04-01" },
    ]);
  });

  test("the target date is optional", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/savings");

    await page.getByRole("button", { name: "Add goal" }).click();
    await dialog(page).getByLabel("Name").fill("Rainy day");
    await dialog(page).getByLabel(/Target amount/).fill("1000");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Rainy day")).toContainText("No target date");
    expect(await goalsOf(userId)).toMatchObject([{ name: "Rainy day", targetDate: null }]);
  });

  test("keeps the goal after a reload", async ({ page }) => {
    await setUp(page);
    await page.goto("/savings");
    await page.getByRole("button", { name: "Add goal" }).click();
    await dialog(page).getByLabel("Name").fill("Rainy day");
    await dialog(page).getByLabel(/Target amount/).fill("1000");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(card(page, "Rainy day")).toBeVisible();

    await page.reload();

    await expect(card(page, "Rainy day")).toBeVisible();
  });

  test("every opening of the form starts fresh, and cancelling saves nothing", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/savings");
    await page.getByRole("button", { name: "Add goal" }).click();
    await dialog(page).getByLabel("Name").fill("Half typed");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Add goal" }).click();

    await expect(dialog(page).getByLabel("Name")).toHaveValue("");
    expect(await goalsOf(userId)).toEqual([]);
  });

  test("the browser stops an empty name before it reaches the server", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/savings");
    await page.getByRole("button", { name: "Add goal" }).click();
    await dialog(page).getByLabel(/Target amount/).fill("10");

    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByLabel("Name")).toBeFocused();
    expect(await goalsOf(userId)).toEqual([]);
  });

  test("shows the server's validation errors next to the fields and keeps what was typed", async ({ page }) => {
    const { userId } = await setUp(page);
    await page.goto("/savings");
    await page.getByRole("button", { name: "Add goal" }).click();
    await skipBrowserValidation(page);

    await dialog(page).getByLabel("Name").fill("   ");
    await dialog(page).getByLabel(/Target amount/).fill("0");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByText("Enter a name")).toBeVisible();
    await expect(dialog(page).getByText("Amount must be greater than zero")).toBeVisible();
    await expect(dialog(page).getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog(page).getByLabel(/Target amount/)).toHaveValue("0");
    expect(await goalsOf(userId)).toEqual([]);

    await dialog(page).getByLabel("Name").fill("Trip");
    await dialog(page).getByLabel(/Target amount/).fill("1.234");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page).getByText("Enter an amount like 12.50")).toBeVisible();

    await dialog(page).getByLabel(/Target amount/).fill("1.23");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(card(page, "Trip"), "of 1.23 ₪");
  });
});

test.describe("editing a goal", () => {
  test("shows the goal's values and saves the changes, keeping its deposits", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip", 6000, "2027-04-01");
    await seedDeposit(userId, goal, 400);
    await page.goto("/savings");

    await page.getByRole("button", { name: "Edit goal Trip" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Edit savings goal" })).toBeVisible();
    await expect(dialog(page).getByLabel("Name")).toHaveValue("Trip");
    await expect(dialog(page).getByLabel(/Target amount/)).toHaveValue("6000");
    await expect(dialog(page).getByLabel(/Target date/)).toHaveValue("2027-04-01");
    await dialog(page).getByLabel("Name").fill("Japan");
    await dialog(page).getByLabel(/Target amount/).fill("8000");
    await dialog(page).getByLabel(/Target date/).fill("");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Trip")).toHaveCount(0);
    await expectReadable(card(page, "Japan"), "400 ₪ of 8,000 ₪");
    await expect(card(page, "Japan")).toContainText("No target date");
    expect(await goalsOf(userId)).toMatchObject([{ name: "Japan", targetAmount: "8000.00", targetDate: null }]);
    expect(await depositsOf(goal)).toHaveLength(1);
  });

  test("leaves the goal unchanged when cancelled", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedGoal(userId, "Trip");
    await page.goto("/savings");
    await page.getByRole("button", { name: "Edit goal Trip" }).click();
    await dialog(page).getByLabel("Name").fill("Changed");

    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Trip")).toBeVisible();
    expect(await goalsOf(userId)).toMatchObject([{ name: "Trip" }]);
  });

  test("says so when the goal was deleted elsewhere, then refreshes the list", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await page.goto("/savings");
    await page.getByRole("button", { name: "Edit goal Trip" }).click();
    await removeGoalRow(goal);

    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Trip")).toHaveCount(0);
  });
});

test.describe("deleting a goal", () => {
  test("asks first, then removes a goal without deposits", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedGoal(userId, "Trip");
    await seedGoal(userId, "Fund");
    await page.goto("/savings");

    await page.getByRole("button", { name: "Delete goal Trip" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Delete goal?" })).toBeVisible();
    await expect(dialog(page)).toContainText("“Trip” will be removed.");
    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(() => cardNames(page)).toEqual(["Fund"]);
    expect((await goalsOf(userId)).map((g) => g.name)).toEqual(["Fund"]);
  });

  test("keeps the goal when cancelled", async ({ page }) => {
    const { userId } = await setUp(page);
    await seedGoal(userId, "Trip");
    await page.goto("/savings");

    await page.getByRole("button", { name: "Delete goal Trip" }).click();
    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Trip")).toBeVisible();
    expect(await goalsOf(userId)).toHaveLength(1);
  });

  test("refuses a goal with deposits, until they are deleted", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await seedDeposit(userId, goal, 100, "2026-10-01");
    await seedDeposit(userId, goal, 50, "2026-10-02");
    await page.goto("/savings");

    await page.getByRole("button", { name: "Delete goal Trip" }).click();
    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("“Trip” still has 2 deposits. Delete them first.");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(card(page, "Trip")).toBeVisible();
    expect(await goalsOf(userId)).toHaveLength(1);

    await openHistory(page, "Trip");
    for (const date of ["2026-10-02", "2026-10-01"]) {
      await page.getByRole("button", { name: `Delete entry of ${date} in Trip` }).click();
      await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();
      await expect(dialog(page)).toHaveCount(0);
    }
    await expect(card(page, "Trip")).toContainText("No deposits yet");
    await page.getByRole("button", { name: "Delete goal Trip" }).click();
    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Trip")).toHaveCount(0);
    expect(await goalsOf(userId)).toEqual([]);
  });

  test("says so when it was already deleted elsewhere, then refreshes the list", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await page.goto("/savings");
    await page.getByRole("button", { name: "Delete goal Trip" }).click();
    await removeGoalRow(goal);

    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(card(page, "Trip")).toHaveCount(0);
  });
});

test.describe("adding and withdrawing money", () => {
  test("adds a deposit, and the goal's balance, progress and total follow", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip", 1000);
    await page.goto("/savings");

    await openAddMoney(page, "Trip");
    await expect(dialog(page).getByRole("heading", { name: "Add or withdraw money" })).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Deposit", exact: true })).toHaveAttribute("aria-pressed", "true");
    const today = await page.evaluate(() => new Date().toLocaleDateString("en-CA"));
    await expect(dialog(page).getByLabel("Date")).toHaveValue(today);
    await dialog(page).getByLabel(/Amount/).fill("250.5");
    await dialog(page).getByLabel("Date").fill("2026-10-20");
    await dialog(page).getByLabel("Note").fill("Birthday money");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(card(page, "Trip"), "250.50 ₪ of 1,000 ₪");
    await expect(card(page, "Trip")).toContainText("25%");
    await expectAmount(cardValue(page, "Total saved"), "250.50 ₪");
    expect(await depositsOf(goal)).toMatchObject([{ amount: "250.50", date: "2026-10-20", note: "Birthday money" }]);
  });

  test("withdraws money", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip", 1000);
    await seedDeposit(userId, goal, 500);
    await page.goto("/savings");

    await addMoney(page, "Trip", { kind: "Withdrawal", amount: "120.25", date: "2026-10-25" });

    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(card(page, "Trip"), "379.75 ₪ of 1,000 ₪");
    await expectAmount(cardValue(page, "Total saved"), "379.75 ₪");
    expect(await depositsOf(goal)).toMatchObject([{ amount: "500.00" }, { amount: "-120.25", date: "2026-10-25" }]);
  });

  test("refuses a withdrawal above the balance, says why next to the amount, and keeps what was typed", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip", 1000);
    await seedDeposit(userId, goal, 100);
    await page.goto("/savings");

    await openAddMoney(page, "Trip");
    await dialog(page).getByRole("button", { name: "Withdrawal", exact: true }).click();
    await dialog(page).getByLabel(/Amount/).fill("100.01");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByText(/This would take the goal below zero/)).toBeVisible();
    await expect(dialog(page).getByLabel(/Amount/)).toHaveAttribute("aria-invalid", "true");
    await expect(dialog(page).getByLabel(/Amount/)).toHaveValue("100.01");
    await expect(dialog(page).getByRole("button", { name: "Withdrawal", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await depositsOf(goal)).toHaveLength(1);

    await dialog(page).getByLabel(/Amount/).fill("100");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(card(page, "Trip"), "0 ₪ of 1,000 ₪");
  });

  test("shows the server's validation errors next to the fields", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await page.goto("/savings");
    await openAddMoney(page, "Trip");
    await skipBrowserValidation(page);

    await dialog(page).getByLabel(/Amount/).fill("0");
    await dialog(page).getByLabel("Date").fill("");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByText("Amount must be greater than zero")).toBeVisible();
    await expect(dialog(page).getByText("Enter a valid date")).toBeVisible();
    expect(await depositsOf(goal)).toEqual([]);
  });

  test("the browser stops an empty amount before it reaches the server", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await page.goto("/savings");
    await openAddMoney(page, "Trip");

    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByLabel(/Amount/)).toBeFocused();
    expect(await depositsOf(goal)).toEqual([]);
  });

  test("every opening of the form starts fresh, and cancelling records nothing", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await page.goto("/savings");
    await openAddMoney(page, "Trip");
    await dialog(page).getByRole("button", { name: "Withdrawal", exact: true }).click();
    await dialog(page).getByLabel(/Amount/).fill("77");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);

    await openAddMoney(page, "Trip");

    await expect(dialog(page).getByLabel(/Amount/)).toHaveValue("");
    await expect(dialog(page).getByRole("button", { name: "Deposit", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await depositsOf(goal)).toEqual([]);
  });

  test("says so when the goal was deleted elsewhere, then refreshes the list", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await page.goto("/savings");
    await openAddMoney(page, "Trip");
    await dialog(page).getByLabel(/Amount/).fill("100");
    await removeGoalRow(goal);

    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, "Trip")).toHaveCount(0);
  });
});

test.describe("a goal's history", () => {
  test("lists the entries newest first, hidden until opened, with signed amounts", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await seedDeposit(userId, goal, 1000, "2026-09-01", "Start");
    await seedDeposit(userId, goal, "250.50", "2026-10-05");
    await seedDeposit(userId, goal, -100, "2026-10-20", "Flight deposit");
    await page.goto("/savings");

    await expect(card(page, "Trip").getByText("History (3)")).toBeVisible();
    await expect(entries(page, "Trip").first()).toBeHidden();
    await openHistory(page, "Trip");

    await expect(entries(page, "Trip")).toHaveCount(3);
    await expectReadable(entries(page, "Trip").nth(0), "2026-10-20−100 ₪Flight deposit");
    await expectReadable(entries(page, "Trip").nth(1), "2026-10-05+250.50 ₪");
    await expectReadable(entries(page, "Trip").nth(2), "2026-09-01+1,000 ₪Start");
  });

  test("a new entry shows up in the history", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await seedDeposit(userId, goal, 100, "2026-09-01");
    await page.goto("/savings");
    await openHistory(page, "Trip");
    await expect(entries(page, "Trip")).toHaveCount(1);

    await addMoney(page, "Trip", { amount: "40", date: "2026-10-10", note: "Gift" });

    await expect(dialog(page)).toHaveCount(0);
    await expect(entries(page, "Trip")).toHaveCount(2);
    await expectReadable(entries(page, "Trip").first(), "2026-10-10+40 ₪Gift");
  });
});

test.describe("editing an entry", () => {
  test("shows the entry's values and saves the changes", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await seedDeposit(userId, goal, 100, "2026-10-05", "First");
    await page.goto("/savings");
    await openHistory(page, "Trip");

    await page.getByRole("button", { name: "Edit entry of 2026-10-05 in Trip" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Edit entry" })).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Deposit", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog(page).getByLabel(/Amount/)).toHaveValue("100");
    await expect(dialog(page).getByLabel("Date")).toHaveValue("2026-10-05");
    await expect(dialog(page).getByLabel("Note")).toHaveValue("First");
    await dialog(page).getByLabel(/Amount/).fill("175.5");
    await dialog(page).getByLabel("Date").fill("2026-10-06");
    await dialog(page).getByLabel("Note").fill("");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(card(page, "Trip"), "175.50 ₪ of 1,000 ₪");
    expect(await depositsOf(goal)).toMatchObject([{ amount: "175.50", date: "2026-10-06", note: null }]);
  });

  test("shows a withdrawal as a positive amount on the Withdrawal side", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await seedDeposit(userId, goal, 500, "2026-10-01");
    await seedDeposit(userId, goal, -120, "2026-10-05");
    await page.goto("/savings");
    await openHistory(page, "Trip");

    await page.getByRole("button", { name: "Edit entry of 2026-10-05 in Trip" }).click();

    await expect(dialog(page).getByRole("button", { name: "Withdrawal", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog(page).getByLabel(/Amount/)).toHaveValue("120");
  });

  test("can turn a deposit into a withdrawal", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await seedDeposit(userId, goal, 500, "2026-10-01");
    await seedDeposit(userId, goal, 100, "2026-10-05");
    await page.goto("/savings");
    await openHistory(page, "Trip");

    await page.getByRole("button", { name: "Edit entry of 2026-10-05 in Trip" }).click();
    await dialog(page).getByRole("button", { name: "Withdrawal", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(card(page, "Trip"), "400 ₪ of 1,000 ₪");
    expect(await depositsOf(goal)).toMatchObject([{ amount: "500.00" }, { amount: "-100.00" }]);
  });

  test("refuses a change that would take the goal below zero", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await seedDeposit(userId, goal, 100, "2026-10-01");
    await seedDeposit(userId, goal, -80, "2026-10-05");
    await page.goto("/savings");
    await openHistory(page, "Trip");

    await page.getByRole("button", { name: "Edit entry of 2026-10-01 in Trip" }).click();
    await dialog(page).getByLabel(/Amount/).fill("50");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByText(/This would take the goal below zero/)).toBeVisible();
    expect(await depositsOf(goal)).toMatchObject([{ amount: "100.00" }, { amount: "-80.00" }]);
  });

  test("says so when the entry was deleted elsewhere, then refreshes the list", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    const deposit = await seedDeposit(userId, goal, 100, "2026-10-05");
    await seedDeposit(userId, goal, 50, "2026-10-06");
    await page.goto("/savings");
    await openHistory(page, "Trip");
    await page.getByRole("button", { name: "Edit entry of 2026-10-05 in Trip" }).click();
    await removeDepositRow(deposit);

    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(card(page, "Trip"), "50 ₪ of 1,000 ₪");
  });
});

test.describe("deleting an entry", () => {
  test("asks first, then removes the entry and updates the balance", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await seedDeposit(userId, goal, 100, "2026-10-05");
    await seedDeposit(userId, goal, 50, "2026-10-06");
    await page.goto("/savings");
    await openHistory(page, "Trip");

    await page.getByRole("button", { name: "Delete entry of 2026-10-05 in Trip" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Delete deposit?" })).toBeVisible();
    await expect(dialog(page)).toContainText("on 2026-10-05 will be removed from “Trip”");
    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(card(page, "Trip"), "50 ₪ of 1,000 ₪");
    await expectAmount(cardValue(page, "Total saved"), "50 ₪");
    expect(await depositsOf(goal)).toMatchObject([{ amount: "50.00" }]);
  });

  test("calls a withdrawal a withdrawal", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await seedDeposit(userId, goal, 100, "2026-10-01");
    await seedDeposit(userId, goal, -30, "2026-10-05");
    await page.goto("/savings");
    await openHistory(page, "Trip");

    await page.getByRole("button", { name: "Delete entry of 2026-10-05 in Trip" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Delete withdrawal?" })).toBeVisible();
    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(card(page, "Trip"), "100 ₪ of 1,000 ₪");
  });

  test("keeps the entry when cancelled", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await seedDeposit(userId, goal, 100, "2026-10-05");
    await page.goto("/savings");
    await openHistory(page, "Trip");

    await page.getByRole("button", { name: "Delete entry of 2026-10-05 in Trip" }).click();
    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(dialog(page)).toHaveCount(0);
    expect(await depositsOf(goal)).toHaveLength(1);
  });

  test("refuses to delete a deposit that later withdrawals depend on", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await seedDeposit(userId, goal, 100, "2026-10-01");
    await seedDeposit(userId, goal, -60, "2026-10-05");
    await page.goto("/savings");
    await openHistory(page, "Trip");

    await page.getByRole("button", { name: "Delete entry of 2026-10-01 in Trip" }).click();
    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("below zero");
    expect(await depositsOf(goal)).toHaveLength(2);
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expectReadable(card(page, "Trip"), "40 ₪ of 1,000 ₪");
  });

  test("says so when it was already deleted elsewhere, then refreshes the list", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    const deposit = await seedDeposit(userId, goal, 100, "2026-10-05");
    await seedDeposit(userId, goal, 50, "2026-10-06");
    await page.goto("/savings");
    await openHistory(page, "Trip");
    await page.getByRole("button", { name: "Delete entry of 2026-10-05 in Trip" }).click();
    await removeDepositRow(deposit);

    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("no longer exists");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expectReadable(card(page, "Trip"), "50 ₪ of 1,000 ₪");
  });
});

test.describe("the dashboard", () => {
  test("shows what all goals hold, and follows new deposits", async ({ page }) => {
    const { userId } = await setUp(page);
    const goal = await seedGoal(userId, "Trip");
    await seedDeposit(userId, goal, 400);
    await page.goto("/dashboard");
    await expectAmount(cardValue(page, "Total saved"), "400 ₪");

    await page.locator("aside").getByRole("link", { name: "Savings & Investments" }).click();
    await addMoney(page, "Trip", { amount: "100.50" });
    await expect(dialog(page)).toHaveCount(0);
    await page.locator("aside").getByRole("link", { name: "Dashboard" }).click();

    // Pages visited earlier stay mounted, hidden: only the dashboard's own card counts
    const visibleTotal = page
      .getByText("Total saved", { exact: true })
      .locator("visible=true")
      .locator("xpath=following-sibling::p[1]");
    await expectAmount(visibleTotal, "500.50 ₪");
  });
});
