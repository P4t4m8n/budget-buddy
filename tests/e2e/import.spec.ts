import { expect, type Page } from "@playwright/test";
import { cp1255CsvFile, csvFile, xlsxFile, type UploadFile } from "./import-files";
import {
  closeDatabase,
  deleteE2eUsers,
  expectReadable,
  findUser,
  hideNextDevIndicator,
  removeCategoryRow,
  seedCategory,
  signUp,
  test,
  transactionsOf,
  type GoogleGrant,
} from "./helpers";

test.afterEach(deleteE2eUsers);
test.afterAll(closeDatabase);

const dialog = (page: Page) => page.getByRole("dialog");
const userIdOf = async (account: GoogleGrant) => (await findUser(account.email))!.id;

// A signed-in user with three expense categories and an income one
async function setUp(page: Page) {
  const account = await signUp(page);
  const userId = await userIdOf(account);
  return {
    userId,
    groceries: await seedCategory(userId, "Groceries", "EXPENSE", "#f59e0b"),
    eatingOut: await seedCategory(userId, "Eating out", "EXPENSE", "#ef4444"),
    health: await seedCategory(userId, "Health", "EXPENSE", "#a855f7"),
    salary: await seedCategory(userId, "Salary", "INCOME", "#10b981"),
  };
}

const STATEMENT = [
  "Date,Description,Amount",
  "30/10/2026,Supermarket,-245.30",
  "31/10/2026,Cafe,-18",
  "01/11/2026,Pharmacy,-45.10",
].join("\n");

const openImport = async (page: Page) => {
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Import from file" }).click();
  await expect(dialog(page).getByRole("heading", { name: "Import transactions" })).toBeVisible();
};

const upload = (page: Page, file: UploadFile) => dialog(page).getByLabel("Spreadsheet file").setInputFiles(file);

// Opens the importer, uploads the file and goes on to the first row
async function startReview(page: Page, file: UploadFile) {
  await openImport(page);
  await upload(page, file);
  await dialog(page).getByRole("button", { name: "Continue" }).click();
  await expect(dialog(page).getByText(/^Row 1$|Row 1 of/)).toBeVisible();
}

const chooseCategory = async (page: Page, name: string) => {
  await dialog(page).getByRole("combobox", { name: "Category" }).click();
  await page.getByRole("option", { name, exact: true }).click();
};

const card = (page: Page, position: number) => dialog(page).getByRole("article", { name: `Row ${position}` });
const step = (page: Page, n: number, label: string) => expect(dialog(page)).toContainText(`Step ${n} of 4 · ${label}`);
const next = (page: Page) => dialog(page).getByRole("button", { name: "Next", exact: true }).click();
const gridRow = (page: Page, text: string) => page.locator(".MuiDataGrid-row").filter({ hasText: text });

test.describe("starting an import", () => {
  test("has an Import button on the transactions page that opens the dialog at the first step", async ({ page }) => {
    await setUp(page);

    await openImport(page);

    await step(page, 1, "Choose a file");
    await expect(dialog(page)).toContainText("nothing is saved until you confirm at the end");
    await expect(dialog(page).getByLabel("Spreadsheet file")).toHaveAttribute("accept", ".xlsx,.csv");
  });

  test("is disabled until there is an expense category", async ({ page }) => {
    const account = await signUp(page);
    await seedCategory(await userIdOf(account), "Salary", "INCOME");
    await page.goto("/transactions");

    await expect(page.getByRole("button", { name: "Import from file" })).toBeDisabled();
  });

  test("is only for signed-in users", async ({ page }) => {
    await page.goto("/transactions");

    await expect(page).toHaveURL(/\/login$/);
  });

  test("cancelling leaves nothing behind", async ({ page }) => {
    const { userId } = await setUp(page);
    await openImport(page);

    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(dialog(page)).toHaveCount(0);
    expect(await transactionsOf(userId)).toEqual([]);
  });
});

test.describe("choosing a file", () => {
  test("refuses a file that isn't .xlsx or .csv", async ({ page }) => {
    await setUp(page);
    await openImport(page);

    await upload(page, { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });

    await expect(dialog(page).getByRole("alert")).toContainText("Choose an .xlsx or .csv file.");
    await step(page, 1, "Choose a file");
  });

  test("refuses an empty file", async ({ page }) => {
    await setUp(page);
    await openImport(page);

    await upload(page, csvFile("", "empty.csv"));

    await expect(dialog(page).getByRole("alert")).toContainText("That file is empty.");
  });

  test("refuses a file with only blank lines", async ({ page }) => {
    await setUp(page);
    await openImport(page);

    await upload(page, csvFile("\n\n,,\n", "blank.csv"));

    await expect(dialog(page).getByRole("alert")).toContainText("That file has no data in it.");
  });

  test("refuses a file over 5 MB", async ({ page }) => {
    await setUp(page);
    await openImport(page);

    await upload(page, {
      name: "huge.csv",
      mimeType: "text/csv",
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1, "a"),
    });

    await expect(dialog(page).getByRole("alert")).toContainText("That file is too large. Use one under 5 MB.");
  });

  test("refuses a file that says .xlsx but isn't one", async ({ page }) => {
    await setUp(page);
    await openImport(page);

    await upload(page, { name: "fake.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("not a zip") });

    await expect(dialog(page).getByRole("alert")).toContainText("That file couldn't be read. Is it a valid .xlsx file?");
  });

  test("lets the user choose another file after a mistake", async ({ page }) => {
    await setUp(page);
    await openImport(page);
    await upload(page, { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(dialog(page).getByRole("alert")).toBeVisible();

    await upload(page, csvFile(STATEMENT));

    await step(page, 2, "Match the columns");
    await expect(dialog(page).getByRole("alert")).toHaveCount(0);
  });
});

test.describe("matching the columns", () => {
  test("detects them from the headers and shows what would be imported", async ({ page }) => {
    await setUp(page);
    await openImport(page);

    await upload(page, csvFile(STATEMENT));

    await step(page, 2, "Match the columns");
    await expect(dialog(page)).toContainText("statement.csv");
    await expect(dialog(page).getByRole("combobox", { name: "Date", exact: true })).toHaveText("Date");
    await expect(dialog(page).getByRole("combobox", { name: "Description", exact: true })).toHaveText("Description");
    await expect(dialog(page).getByRole("combobox", { name: "Amount", exact: true })).toHaveText("Amount");
    await expect(dialog(page)).toContainText("3 rows can be imported");
    const preview = dialog(page).getByRole("table");
    await expect(preview.getByRole("row")).toHaveCount(4);
    await expectReadable(preview, "2026-10-30Supermarket245.30 ₪");
    await expectReadable(preview, "2026-10-31Cafe18 ₪");
    await expect(dialog(page).getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("shows negative amounts as the positive expenses they will be", async ({ page }) => {
    await setUp(page);
    await openImport(page);

    await upload(page, csvFile(STATEMENT));

    await expectReadable(dialog(page).getByRole("table"), "45.10 ₪");
    await expect(dialog(page).getByRole("table")).not.toContainText("-245.30");
    await expect(dialog(page).getByRole("table")).not.toContainText("-18");
    await expect(dialog(page).getByRole("table")).not.toContainText("-45.10");
  });

  test("finds the header below lines about the account", async ({ page }) => {
    await setUp(page);
    await openImport(page);

    await upload(
      page,
      csvFile(["Account 123-456", "Statement for October 2026", "", STATEMENT].join("\n")),
    );

    await expect(dialog(page).getByRole("combobox", { name: "Row with the column names" })).toContainText("Row 4:");
    await expect(dialog(page)).toContainText("3 rows can be imported");
  });

  test("lets the user pick another row as the header", async ({ page }) => {
    await setUp(page);
    await openImport(page);
    await upload(page, csvFile(["Statement", STATEMENT].join("\n")));
    await expect(dialog(page)).toContainText("3 rows can be imported");

    await dialog(page).getByRole("combobox", { name: "Row with the column names" }).click();
    await page.getByRole("option", { name: /^Row 1:/ }).click();

    // The old header line is now just a row, and it isn't a transaction
    await expect(dialog(page)).toContainText("1 will be skipped");
    await dialog(page).getByText("Rows that will be skipped (1)").click();
    await expect(dialog(page)).toContainText("Row 2: Couldn't read the date");

    await dialog(page).getByRole("combobox", { name: "Row with the column names" }).click();
    await page.getByRole("option", { name: /^Row 2:/ }).click();

    await expect(dialog(page)).toContainText("3 rows can be imported");
    await expect(dialog(page)).not.toContainText("will be skipped");
    await expect(dialog(page).getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("guesses columns from their contents when the headers don't say", async ({ page }) => {
    await setUp(page);
    await openImport(page);

    await upload(
      page,
      csvFile(
        ["A,B,C", "30/10/2026,Supermarket downtown,-245.30", "31/10/2026,Cafe,-18", "01/11/2026,Pharmacy on the corner,-45.10"].join("\n"),
      ),
    );

    await expect(dialog(page).getByRole("combobox", { name: "Date", exact: true })).toHaveText("A");
    await expect(dialog(page).getByRole("combobox", { name: "Description", exact: true })).toHaveText("B");
    await expect(dialog(page).getByRole("combobox", { name: "Amount", exact: true })).toHaveText("C");
    await expect(dialog(page)).toContainText("3 rows can be imported");
  });

  test("lets the user correct a column, and updates what would be imported", async ({ page }) => {
    await setUp(page);
    await openImport(page);
    await upload(
      page,
      csvFile(["Date,Description,Debit,Credit", "30/10/2026,Supermarket,245.30,", "31/10/2026,Refund,,50.00"].join("\n")),
    );
    await expect(dialog(page).getByRole("combobox", { name: "Amount", exact: true })).toHaveText("Debit");
    await expect(dialog(page)).toContainText("1 row can be imported");
    await expect(dialog(page)).toContainText("1 will be skipped");

    await dialog(page).getByRole("combobox", { name: "Amount", exact: true }).click();
    await page.getByRole("option", { name: "Credit", exact: true }).click();

    await expectReadable(dialog(page).getByRole("table"), "Refund50 ₪");
    await expect(dialog(page)).toContainText("1 row can be imported");
  });

  test("needs all three columns before continuing", async ({ page }) => {
    await setUp(page);
    await openImport(page);

    await upload(page, csvFile(["Date,Amount", "30/10/2026,-245.30", "31/10/2026,-18"].join("\n")));

    await expect(dialog(page).getByRole("alert")).toContainText(
      "Choose a column for the date, the description and the amount.",
    );
    await expect(dialog(page).getByRole("button", { name: "Continue" })).toBeDisabled();

    await dialog(page).getByRole("combobox", { name: "Description", exact: true }).click();
    await page.getByRole("option", { name: "Date", exact: true }).click();

    await expect(dialog(page).getByRole("alert")).toHaveCount(0);
    await expect(dialog(page).getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("says which rows will be skipped and why", async ({ page }) => {
    await setUp(page);
    await openImport(page);

    await upload(
      page,
      csvFile(
        [
          "Date,Description,Amount",
          "30/10/2026,Supermarket,-245.30",
          "31/02/2026,Bad date,-5",
          "01/11/2026,No amount,",
          "02/11/2026,Words,n/a",
          "03/11/2026,Free,0",
          ",Total,-250.30",
        ].join("\n"),
      ),
    );

    await expect(dialog(page)).toContainText("1 row can be imported");
    await expect(dialog(page)).toContainText("5 will be skipped");
    await dialog(page).getByText("Rows that will be skipped (5)").click();
    await expect(dialog(page)).toContainText("Row 3: Couldn't read the date");
    await expect(dialog(page)).toContainText("Row 4: No amount");
    await expect(dialog(page)).toContainText("Row 5: Couldn't read the amount");
    await expect(dialog(page)).toContainText("Row 6: The amount is zero");
    await expect(dialog(page)).toContainText("Row 7: Couldn't read the date");
  });

  test("won't continue with more than 500 rows", async ({ page }) => {
    await setUp(page);
    await openImport(page);
    const lines = ["Date,Description,Amount", ...Array.from({ length: 501 }, (_, i) => `01/10/2026,Row ${i},-1`)];

    await upload(page, csvFile(lines.join("\n"), "big.csv"));

    await expect(dialog(page).getByRole("alert")).toContainText("This file has 501 rows. Import up to 500 at a time");
    await expect(dialog(page).getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  test("goes back to choose another file", async ({ page }) => {
    await setUp(page);
    await openImport(page);
    await upload(page, csvFile(STATEMENT));

    await dialog(page).getByRole("button", { name: "Choose another file" }).click();

    await step(page, 1, "Choose a file");
  });
});

test.describe("choosing a category for each row", () => {
  test("shows one row at a time, and moves on once it has a category", async ({ page }) => {
    await setUp(page);
    await openImport(page);
    await upload(page, csvFile(STATEMENT));

    await dialog(page).getByRole("button", { name: "Continue" }).click();

    await step(page, 3, "Choose a category for each row");
    await expect(dialog(page)).toContainText("Row 1 of 3");
    await expect(dialog(page)).toContainText("Row 2 in your file");
    await expect(card(page, 1)).toContainText("Supermarket");
    await expect(card(page, 1)).toContainText("2026-10-30");
    await expectReadable(card(page, 1), "245.30 ₪");
    await expect(dialog(page).getByRole("progressbar", { name: "Import progress" })).toHaveAttribute("aria-valuenow", "1");
    await expect(dialog(page).getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    await expect(dialog(page).getByRole("button", { name: "Back", exact: true })).toBeDisabled();

    await chooseCategory(page, "Groceries");
    await next(page);

    await expect(dialog(page)).toContainText("Row 2 of 3");
    await expect(card(page, 2)).toContainText("Cafe");
    await expect(dialog(page).getByRole("progressbar", { name: "Import progress" })).toHaveAttribute("aria-valuenow", "2");
    await expect(dialog(page).getByRole("combobox", { name: "Category" })).toHaveText("Choose a category");
    await expect(dialog(page).getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  });

  test("offers only the expense categories", async ({ page }) => {
    await setUp(page);
    await startReview(page, csvFile(STATEMENT));

    await dialog(page).getByRole("combobox", { name: "Category" }).click();

    await expect(page.getByRole("option")).toHaveText(["Eating out", "Groceries", "Health"]);
  });

  test("goes back to a row and keeps the category chosen for it", async ({ page }) => {
    await setUp(page);
    await startReview(page, csvFile(STATEMENT));
    await chooseCategory(page, "Groceries");
    await next(page);
    await chooseCategory(page, "Eating out");

    await dialog(page).getByRole("button", { name: "Back", exact: true }).click();

    await expect(dialog(page)).toContainText("Row 1 of 3");
    await expect(dialog(page).getByRole("combobox", { name: "Category" })).toHaveText("Groceries");
    await next(page);
    await expect(dialog(page)).toContainText("Row 2 of 3");
    await expect(dialog(page).getByRole("combobox", { name: "Category" })).toHaveText("Eating out");
  });

  test("can change a row's category after going back", async ({ page }) => {
    await setUp(page);
    await startReview(page, csvFile(STATEMENT));
    await chooseCategory(page, "Groceries");
    await next(page);
    await dialog(page).getByRole("button", { name: "Back", exact: true }).click();

    await chooseCategory(page, "Health");

    await expect(dialog(page).getByRole("combobox", { name: "Category" })).toHaveText("Health");
  });

  test("skips a row and moves on, and says so when coming back to it", async ({ page }) => {
    await setUp(page);
    await startReview(page, csvFile(STATEMENT));
    await chooseCategory(page, "Groceries");
    await next(page);

    await dialog(page).getByRole("button", { name: "Skip", exact: true }).click();

    await expect(dialog(page)).toContainText("Row 3 of 3");
    await dialog(page).getByRole("button", { name: "Back", exact: true }).click();
    await expect(dialog(page)).toContainText("Row 2 of 3");
    await expect(dialog(page)).toContainText("Skipped: this row won't be imported.");
    // A skipped row can be moved past without choosing anything
    await expect(dialog(page).getByRole("button", { name: "Next", exact: true })).toBeEnabled();
  });

  test("includes a skipped row again once it is given a category", async ({ page }) => {
    await setUp(page);
    await startReview(page, csvFile(STATEMENT));
    await dialog(page).getByRole("button", { name: "Skip", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Back", exact: true }).click();
    await expect(dialog(page)).toContainText("Skipped: this row won't be imported.");

    await chooseCategory(page, "Health");

    await expect(dialog(page)).not.toContainText("Skipped: this row won't be imported.");
  });

  test("the last row leads to the summary", async ({ page }) => {
    await setUp(page);
    await startReview(page, csvFile("Date,Description,Amount\n30/10/2026,Only row,-10"));

    await expect(dialog(page).getByRole("button", { name: "Review", exact: true })).toBeDisabled();
    await chooseCategory(page, "Groceries");
    await dialog(page).getByRole("button", { name: "Review", exact: true }).click();

    await step(page, 4, "Check and import");
  });

  test("keeps a long description to what a transaction can hold", async ({ page }) => {
    await setUp(page);
    await startReview(page, csvFile(`Date,Description,Amount\n30/10/2026,${"a".repeat(150)},-10`));

    await expect(card(page, 1)).toContainText("a".repeat(120));
    await expect(card(page, 1)).not.toContainText("a".repeat(121));
  });

  test("says what to do about a missing category", async ({ page }) => {
    await setUp(page);
    await startReview(page, csvFile(STATEMENT));

    await expect(dialog(page)).toContainText("Missing a category? Create it on the Categories page");
  });
});

test.describe("importing", () => {
  test("shows what will be added before saving anything, then adds the transactions", async ({ page }) => {
    const { userId, groceries, eatingOut, health } = await setUp(page);
    await startReview(page, csvFile(STATEMENT));
    await chooseCategory(page, "Groceries");
    await next(page);
    await chooseCategory(page, "Eating out");
    await next(page);
    await chooseCategory(page, "Health");
    await dialog(page).getByRole("button", { name: "Review", exact: true }).click();

    await step(page, 4, "Check and import");
    await expectReadable(dialog(page), "3 transactions will be added,308.40 ₪in total");
    const summary = dialog(page).getByRole("table");
    await expectReadable(summary.getByRole("row").nth(1), "Groceries1245.30 ₪");
    await expectReadable(summary.getByRole("row").nth(2), "Health145.10 ₪");
    await expectReadable(summary.getByRole("row").nth(3), "Eating out118 ₪");
    expect(await transactionsOf(userId)).toEqual([]);

    await dialog(page).getByRole("button", { name: "Import 3 transactions" }).click();

    await expect(dialog(page)).toContainText("Imported 3 transactions.");
    await step(page, 4, "Done");
    expect(await transactionsOf(userId)).toMatchObject([
      { description: "Supermarket", amount: "245.30", type: "EXPENSE", currency: "ILS", categoryId: groceries, date: "2026-10-30" },
      { description: "Cafe", amount: "18.00", type: "EXPENSE", currency: "ILS", categoryId: eatingOut, date: "2026-10-31" },
      { description: "Pharmacy", amount: "45.10", type: "EXPENSE", currency: "ILS", categoryId: health, date: "2026-11-01" },
    ]);

    await dialog(page).getByRole("button", { name: "Done" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(gridRow(page, "Supermarket")).toBeVisible();
    await expect(gridRow(page, "Cafe")).toContainText("Eating out");
    await expect(gridRow(page, "Pharmacy")).toContainText("Health");
  });

  test("leaves out skipped rows", async ({ page }) => {
    const { userId } = await setUp(page);
    await startReview(page, csvFile(STATEMENT));
    await chooseCategory(page, "Groceries");
    await next(page);
    await dialog(page).getByRole("button", { name: "Skip", exact: true }).click();
    await chooseCategory(page, "Health");
    await dialog(page).getByRole("button", { name: "Review", exact: true }).click();

    await expectReadable(dialog(page), "2 transactions will be added,290.40 ₪in total; 1 row was skipped.");
    await dialog(page).getByRole("button", { name: "Import 2 transactions" }).click();

    await expect(dialog(page)).toContainText("Imported 2 transactions.");
    expect((await transactionsOf(userId)).map((t) => t.description)).toEqual(["Supermarket", "Pharmacy"]);
  });

  test("goes back from the summary to change a choice", async ({ page }) => {
    const { userId, health } = await setUp(page);
    await startReview(page, csvFile("Date,Description,Amount\n30/10/2026,Only row,-10"));
    await chooseCategory(page, "Groceries");
    await dialog(page).getByRole("button", { name: "Review", exact: true }).click();
    await expect(dialog(page).getByRole("table")).toContainText("Groceries");

    await dialog(page).getByRole("button", { name: "Back to review" }).click();
    await expect(dialog(page).getByRole("combobox", { name: "Category" })).toHaveText("Groceries");
    await chooseCategory(page, "Health");
    await dialog(page).getByRole("button", { name: "Review", exact: true }).click();

    await expect(dialog(page).getByRole("table")).toContainText("Health");
    await dialog(page).getByRole("button", { name: "Import 1 transaction" }).click();
    await expect(dialog(page)).toContainText("Imported 1 transaction.");
    expect(await transactionsOf(userId)).toMatchObject([{ categoryId: health }]);
  });

  test("can't import when every row was skipped", async ({ page }) => {
    const { userId } = await setUp(page);
    await startReview(page, csvFile("Date,Description,Amount\n30/10/2026,Only row,-10"));
    await dialog(page).getByRole("button", { name: "Skip", exact: true }).click();

    await expect(dialog(page)).toContainText("No rows are set to be imported.");
    await expect(dialog(page).getByRole("button", { name: /^Import 0 transactions$/ })).toBeDisabled();
    expect(await transactionsOf(userId)).toEqual([]);
  });

  test("adds identical rows as separate transactions: the same purchase twice in a day is real", async ({ page }) => {
    const { userId } = await setUp(page);
    await startReview(
      page,
      csvFile(
        ["Date,Description,Amount", "31/10/2026,Falafel,-25", "31/10/2026,Falafel,-25", "31/10/2026,Falafel,-25"].join("\n"),
      ),
    );

    for (let i = 0; i < 2; i++) {
      await chooseCategory(page, "Eating out");
      await next(page);
    }
    await chooseCategory(page, "Eating out");
    await dialog(page).getByRole("button", { name: "Review", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Import 3 transactions" }).click();

    await expect(dialog(page)).toContainText("Imported 3 transactions.");
    expect(await transactionsOf(userId)).toHaveLength(3);
  });

  test("imports it again when the same file is imported twice", async ({ page }) => {
    const { userId } = await setUp(page);
    const file = csvFile("Date,Description,Amount\n30/10/2026,Only row,-10");

    for (let round = 0; round < 2; round++) {
      await startReview(page, file);
      await chooseCategory(page, "Groceries");
      await dialog(page).getByRole("button", { name: "Review", exact: true }).click();
      await dialog(page).getByRole("button", { name: "Import 1 transaction" }).click();
      await expect(dialog(page)).toContainText("Imported 1 transaction.");
      await dialog(page).getByRole("button", { name: "Done" }).click();
      await expect(dialog(page)).toHaveCount(0);
    }

    expect(await transactionsOf(userId)).toHaveLength(2);
  });

  test("reads amounts with thousands separators and currency signs", async ({ page }) => {
    const { userId } = await setUp(page);
    await startReview(
      page,
      csvFile(['Date,Description,Amount', '30/10/2026,Rent,"₪ 4,500.00"', '31/10/2026,Fridge,"(1,299.90)"'].join("\n")),
    );
    await chooseCategory(page, "Groceries");
    await next(page);
    await chooseCategory(page, "Groceries");
    await dialog(page).getByRole("button", { name: "Review", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Import 2 transactions" }).click();

    await expect(dialog(page)).toContainText("Imported 2 transactions.");
    expect((await transactionsOf(userId)).map((t) => t.amount)).toEqual(["4500.00", "1299.90"]);
  });

  test("closing the dialog throws the import away, and the next one starts over", async ({ page }) => {
    const { userId } = await setUp(page);
    await startReview(page, csvFile(STATEMENT));
    await chooseCategory(page, "Groceries");
    await next(page);

    // Clicking inside puts the focus in the dialog, which Escape needs: the button that had it
    // was just disabled by moving on to the next row
    await dialog(page).getByRole("heading", { name: "Import transactions" }).click();
    await page.keyboard.press("Escape");

    await expect(dialog(page)).toHaveCount(0);
    expect(await transactionsOf(userId)).toEqual([]);
    await page.getByRole("button", { name: "Import from file" }).click();
    await step(page, 1, "Choose a file");
  });

  test("says so when a chosen category was deleted elsewhere, and saves nothing", async ({ page }) => {
    const { userId, health } = await setUp(page);
    await startReview(page, csvFile(STATEMENT));
    await chooseCategory(page, "Groceries");
    await next(page);
    await chooseCategory(page, "Eating out");
    await next(page);
    await chooseCategory(page, "Health");
    await dialog(page).getByRole("button", { name: "Review", exact: true }).click();
    await removeCategoryRow(health);

    await dialog(page).getByRole("button", { name: "Import 3 transactions" }).click();

    await expect(dialog(page).getByRole("alert")).toContainText("Choose one of your expense categories for every row");
    expect(await transactionsOf(userId)).toEqual([]);
    await expect(dialog(page).getByRole("button", { name: "Import 3 transactions" })).toBeEnabled();
  });

  test("the imported expenses count towards the month's budget and the dashboard", async ({ page }) => {
    await setUp(page);
    const month = new Date().toLocaleDateString("en-CA").slice(0, 7);
    await startReview(page, csvFile(`Date,Description,Amount\n05/${month.slice(5)}/${month.slice(0, 4)},Imported shop,-120`));
    await chooseCategory(page, "Groceries");
    await dialog(page).getByRole("button", { name: "Review", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Import 1 transaction" }).click();
    await expect(dialog(page)).toContainText("Imported 1 transaction.");
    await dialog(page).getByRole("button", { name: "Done" }).click();

    await page.locator("aside").getByRole("link", { name: "Budget", exact: true }).click();

    await expectReadable(page.getByRole("listitem", { name: "Groceries", exact: true }), "120 ₪ spent · no budget");
  });
});

test.describe("other kinds of files", () => {
  test("imports a real .xlsx spreadsheet, with date cells and numeric amounts", async ({ page }) => {
    const { userId, groceries, eatingOut } = await setUp(page);
    const file = await xlsxFile([
      ["Date", "Description", "Amount"],
      [new Date("2026-10-30T00:00:00Z"), "Supermarket", -245.3],
      [new Date("2026-10-31T00:00:00Z"), "Cafe", -18],
    ]);
    await openImport(page);

    await upload(page, file);

    await step(page, 2, "Match the columns");
    await expect(dialog(page)).toContainText("2 rows can be imported");
    await expectReadable(dialog(page).getByRole("table"), "2026-10-30Supermarket245.30 ₪");
    await dialog(page).getByRole("button", { name: "Continue" }).click();
    await chooseCategory(page, "Groceries");
    await next(page);
    await chooseCategory(page, "Eating out");
    await dialog(page).getByRole("button", { name: "Review", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Import 2 transactions" }).click();

    await expect(dialog(page)).toContainText("Imported 2 transactions.");
    expect(await transactionsOf(userId)).toMatchObject([
      { description: "Supermarket", amount: "245.30", date: "2026-10-30", categoryId: groceries },
      { description: "Cafe", amount: "18.00", date: "2026-10-31", categoryId: eatingOut },
    ]);
  });

  test("reads a .xlsx with text dates and a title above the header", async ({ page }) => {
    await setUp(page);
    const file = await xlsxFile([
      ["Bank statement"],
      [null],
      ["Date", "Details", "Debit"],
      ["30/10/2026", "Supermarket", 245.3],
      ["31/10/2026", "Cafe", 18],
    ]);
    await openImport(page);

    await upload(page, file);

    await expect(dialog(page).getByRole("combobox", { name: "Row with the column names" })).toContainText("Row 3:");
    await expect(dialog(page)).toContainText("2 rows can be imported");
  });

  test("imports a Hebrew bank file saved as windows-1255 with semicolons and decimal commas", async ({ page }) => {
    const { userId } = await setUp(page);
    const file = cp1255CsvFile(
      [
        "פירוט עסקאות לחשבון 123-456",
        "תאריך עסקה;תאריך חיוב;שם בית עסק;סכום חיוב",
        "30/10/2026;10/11/2026;שופרסל;245,30",
        "31/10/2026;10/11/2026;קפה גרג;18",
      ].join("\r\n"),
    );
    await openImport(page);

    await upload(page, file);

    await expect(dialog(page).getByRole("combobox", { name: "Date", exact: true })).toHaveText("תאריך עסקה");
    await expect(dialog(page).getByRole("combobox", { name: "Description", exact: true })).toHaveText("שם בית עסק");
    await expect(dialog(page).getByRole("combobox", { name: "Amount", exact: true })).toHaveText("סכום חיוב");
    await expect(dialog(page)).toContainText("2 rows can be imported");
    await dialog(page).getByRole("button", { name: "Continue" }).click();
    await expect(card(page, 1)).toContainText("שופרסל");
    await expectReadable(card(page, 1), "245.30 ₪");
    await chooseCategory(page, "Groceries");
    await next(page);
    await chooseCategory(page, "Eating out");
    await dialog(page).getByRole("button", { name: "Review", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Import 2 transactions" }).click();

    await expect(dialog(page)).toContainText("Imported 2 transactions.");
    expect(await transactionsOf(userId)).toMatchObject([
      { description: "שופרסל", amount: "245.30", date: "2026-10-30" },
      { description: "קפה גרג", amount: "18.00", date: "2026-10-31" },
    ]);
  });

  test("reads a UTF-8 file with a byte order mark and semicolons", async ({ page }) => {
    await setUp(page);
    await openImport(page);

    await upload(
      page,
      csvFile(["\uFEFFDate;Description;Amount", "30/10/2026;Supermarket;-245,30"].join("\n"), "excel.csv"),
    );

    await expect(dialog(page)).toContainText("1 row can be imported");
    await expectReadable(dialog(page).getByRole("table"), "Supermarket245.30 ₪");
  });
});

test.describe("each user's own data", () => {
  test("only adds to the signed-in user's account, and a user can't see another's imports", async ({ page, browser }) => {
    const { userId } = await setUp(page);
    await startReview(page, csvFile("Date,Description,Amount\n30/10/2026,Dana's private shop,-10"));
    await chooseCategory(page, "Groceries");
    await dialog(page).getByRole("button", { name: "Review", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Import 1 transaction" }).click();
    await expect(dialog(page)).toContainText("Imported 1 transaction.");
    await dialog(page).getByRole("button", { name: "Done" }).click();
    await expect(gridRow(page, "Dana's private shop")).toBeVisible();

    const otherContext = await browser.newContext({ baseURL: "http://localhost:3100" });
    await hideNextDevIndicator(otherContext);
    const otherPage = await otherContext.newPage();
    const otherAccount = await signUp(otherPage, "Noa Cohen");
    await otherPage.goto("/transactions");

    await expect(otherPage.getByText("Dana's private shop")).toHaveCount(0);
    expect(await transactionsOf(await userIdOf(otherAccount))).toEqual([]);
    expect(await transactionsOf(userId)).toHaveLength(1);
    await otherContext.close();
  });
});
