import { expect, test as base, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool, type QueryResultRow } from "pg";
import { APP_TIME_ZONE } from "../../lib/constants";
import { currentMonth } from "../../lib/dates";
import { getTestDatabaseUrl } from "../setup/test-db";
import { E2E_EMAIL_DOMAIN } from "./env";

// The pages work out "this month" themselves; the tests ask the same helper, so they agree
export const thisMonth = () => currentMonth(new Date(), APP_TIME_ZONE);

export const day = (month: string, dayOfMonth: number) =>
  `${month}-${String(dayOfMonth).padStart(2, "0")}`;

// The Hebrew currency format wraps amounts in invisible direction marks and uses no-break
// spaces; compare what the user reads
export const readable = (text: string | null) =>
  (text ?? "").replace(/[\u200e\u200f]/g, "").replace(/\u00a0/g, " ");

export const expectReadable = (locator: Locator, expected: string) =>
  expect.poll(async () => readable(await locator.textContent())).toContain(expected);

export const expectAmount = (locator: Locator, expected: string) =>
  expect.poll(async () => readable(await locator.textContent())).toBe(expected);

// The big number of a summary card, found by its label
export const cardValue = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).locator("xpath=following-sibling::p[1]");

// In dev, Next's round "N" indicator floats over the bottom-left of the sidebar, right on top
// of the Sign out button, and swallows clicks. It doesn't exist in production builds.
export async function hideNextDevIndicator(context: BrowserContext) {
  await context.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "nextjs-portal { display: none !important; }";
    new MutationObserver((_, observer) => {
      if (document.head) {
        document.head.append(style);
        observer.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
  });
}

export const test = base.extend({
  context: async ({ context }, provide) => {
    await hideNextDevIndicator(context);
    await provide(context);
  },
});

// Plain pg (not the app's Prisma client) so the tests check the database independently of the app.
// Created on first use and recreated after closeDatabase(): with one worker, every spec file
// shares this module, and each file closes the pool when it finishes.
const connection = new URL(getTestDatabaseUrl());
connection.search = "";

let activePool: Pool | undefined;

const pool = {
  query: <R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]) => {
    activePool ??= new Pool({ connectionString: connection.toString() });
    return activePool.query<R>(text, values);
  },
};

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  googleIdHash: string;
};

export async function findUser(email: string) {
  const { rows } = await pool.query<UserRow>(
    'select id, email, name, image, "googleIdHash" from "User" where email = $1',
    [email],
  );
  return rows[0];
}

export async function countUsers(email: string) {
  const { rows } = await pool.query<{ count: string }>(
    'select count(*) from "User" where email = $1',
    [email],
  );
  return Number(rows[0].count);
}

export async function sessionsOf(userId: string) {
  const { rows } = await pool.query<{ tokenHash: string; expiresAt: Date }>(
    'select "tokenHash", "expiresAt" from "Session" where "userId" = $1',
    [userId],
  );
  return rows;
}

export async function expireSessionsOf(userId: string) {
  await pool.query(
    `update "Session" set "expiresAt" = now() - interval '1 minute' where "userId" = $1`,
    [userId],
  );
}

// Only removes users these tests created; their sessions go with them (cascade)
export async function deleteE2eUsers() {
  await pool.query('delete from "User" where email like $1', [`%${E2E_EMAIL_DOMAIN}`]);
}

export async function closeDatabase() {
  const closing = activePool;
  activePool = undefined;
  await closing?.end();
}

export type GoogleGrant = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified?: boolean;
  claimOverrides?: Record<string, unknown>;
  // Simulates clicking "Cancel" on Google's consent screen
  deny?: boolean;
};

export function newGoogleAccount(name = "Dana Levi"): GoogleGrant {
  const id = randomUUID();
  return { sub: `e2e-sub-${id}`, email: `dana-${id.slice(0, 8)}${E2E_EMAIL_DOMAIN}`, name };
}

// Stands in for Google's consent screen. Playwright can't intercept the browser's
// redirect to accounts.google.com, so this takes over one step earlier: it lets the
// app answer /api/auth/google as usual (keeping its cookies), then swaps the
// redirect target for the app's own callback with an authorization code for `grant`.
// `grant` is read on every request, so a test can change it between sign-ins.
export async function mockGoogleConsent(page: Page, grant: GoogleGrant) {
  const visits: { authorizationUrl: URL; callbackUrl: string }[] = [];

  await page.route("**/api/auth/google", async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const url = new URL(response.headers()["location"]);
    const callback = new URL(url.searchParams.get("redirect_uri")!);
    callback.searchParams.set("state", url.searchParams.get("state")!);

    if (grant.deny) {
      callback.searchParams.set("error", "access_denied");
    } else {
      const code = Buffer.from(
        JSON.stringify({
          sub: grant.sub,
          email: grant.email,
          name: grant.name,
          picture: grant.picture,
          emailVerified: grant.emailVerified,
          claimOverrides: grant.claimOverrides,
          nonce: url.searchParams.get("nonce"),
          challenge: url.searchParams.get("code_challenge"),
        }),
      ).toString("base64url");
      callback.searchParams.set("code", code);
    }

    visits.push({ authorizationUrl: url, callbackUrl: callback.toString() });
    await route.fulfill({
      response,
      headers: { ...response.headers(), location: callback.toString() },
    });
  });

  return visits;
}

export async function signInWithGoogle(page: Page) {
  await page.goto("/login");
  await page.getByRole("link", { name: "Continue with Google" }).click();
}

// Signs a brand-new Google account in and returns it
export async function signUp(page: Page, name = "Dana Levi") {
  const account = newGoogleAccount(name);
  await mockGoogleConsent(page, account);
  await signInWithGoogle(page);
  await page.waitForURL(/\/dashboard$/);
  return account;
}

export async function categoriesOf(userId: string) {
  const { rows } = await pool.query<{ id: string; name: string; type: string; color: string }>(
    'select id, name, type, color from "Category" where "userId" = $1 order by name',
    [userId],
  );
  return rows;
}

// Simulates another tab or device deleting the category
export async function removeCategoryRow(id: string) {
  await pool.query('delete from "Category" where id = $1', [id]);
}

export async function seedCategory(
  userId: string,
  name: string,
  type: "INCOME" | "EXPENSE" = "EXPENSE",
  color = "#f59e0b",
) {
  const id = randomUUID();
  await pool.query(
    `insert into "Category" (id, "userId", name, type, color)
     values ($1, $2, $3, $4::"TransactionType", $5)`,
    [id, userId, name, type, color],
  );
  return id;
}

export type SeededTransaction = {
  description: string;
  amount: number | string;
  date: string;
  type?: "INCOME" | "EXPENSE";
};

export async function seedTransaction(
  userId: string,
  categoryId: string,
  { description, amount, date, type = "EXPENSE" }: SeededTransaction,
) {
  const id = randomUUID();
  await pool.query(
    `insert into "Transaction" (id, "userId", "categoryId", description, amount, type, date)
     values ($1, $2, $3, $4, $5, $6::"TransactionType", $7)`,
    [id, userId, categoryId, description, amount, type, date],
  );
  return id;
}

export async function transactionsOf(userId: string) {
  const { rows } = await pool.query<{
    id: string;
    description: string;
    amount: string;
    type: string;
    categoryId: string;
    date: string;
    note: string | null;
    currency: string;
  }>(
    `select id, description, amount::text as amount, type, "categoryId",
            to_char(date, 'YYYY-MM-DD') as date, note, currency
     from "Transaction" where "userId" = $1 order by "createdAt"`,
    [userId],
  );
  return rows;
}

export async function removeTransactionRow(id: string) {
  await pool.query('delete from "Transaction" where id = $1', [id]);
}

export async function seedBudget(
  userId: string,
  categoryId: string,
  month: string,
  limit: number | string,
) {
  const id = randomUUID();
  await pool.query(
    `insert into "Budget" (id, "userId", "categoryId", month, "limit")
     values ($1, $2, $3, $4::date, $5)`,
    [id, userId, categoryId, `${month}-01`, limit],
  );
  return id;
}

export async function budgetsOf(userId: string) {
  const { rows } = await pool.query<{
    id: string;
    categoryId: string;
    month: string;
    limit: string;
    currency: string;
  }>(
    `select id, "categoryId", to_char(month, 'YYYY-MM') as month, "limit"::text as "limit", currency
     from "Budget" where "userId" = $1 order by month, "categoryId"`,
    [userId],
  );
  return rows;
}

// Simulates another tab or device removing the budget
export async function removeBudgetRow(id: string) {
  await pool.query('delete from "Budget" where id = $1', [id]);
}

export async function insertTransaction(userId: string, categoryId: string, type = "EXPENSE") {
  await pool.query(
    `insert into "Transaction" (id, "userId", "categoryId", description, amount, type, date)
     values ($1, $2, $3, 'seeded', 10, $4::"TransactionType", '2026-10-01')`,
    [randomUUID(), userId, categoryId, type],
  );
}
