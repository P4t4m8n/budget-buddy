import { expect, type Page } from "@playwright/test";
import {
  closeDatabase,
  countUsers,
  deleteE2eUsers,
  expireSessionsOf,
  findUser,
  hideNextDevIndicator,
  mockGoogleConsent,
  newGoogleAccount,
  sessionsOf,
  signInWithGoogle,
  test,
} from "./helpers";
import { E2E_CLIENT_ID } from "./env";

const PROTECTED_PAGES = [
  "/",
  "/dashboard",
  "/transactions",
  "/categories",
  "/budget",
  "/savings",
  "/wishlist",
];

// Not getByRole("alert"): Next adds its own route announcer with that role to every page
const loginError = (page: Page) => page.getByTestId("login-error");

test.afterEach(deleteE2eUsers);
test.afterAll(closeDatabase);

test.describe("signed out", () => {
  for (const path of PROTECTED_PAGES) {
    test(`${path} redirects to the login page`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
    });
  }

  test("protected API routes answer 401, public auth routes do not", async ({ request }) => {
    const protectedRoute = await request.get("/api/transactions");
    expect(protectedRoute.status()).toBe(401);
    expect(await protectedRoute.json()).toEqual({ error: "Unauthorized" });

    // Reachable without a session; it is just POST only
    expect((await request.get("/api/auth/logout")).status()).toBe(405);
  });

  test("the login page offers Google sign-in", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Budget Buddy" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      "/api/auth/google",
    );
    await expect(loginError(page)).toHaveCount(0);
  });

  const messages: [string, string][] = [
    ["access_denied", "Sign-in was cancelled"],
    ["invalid_request", "invalid or expired"],
    ["google_failed", "Google sign-in failed"],
    ["server_error", "Something went wrong"],
  ];
  for (const [code, text] of messages) {
    test(`the login page explains the ${code} error`, async ({ page }) => {
      await page.goto(`/login?error=${code}`);
      await expect(loginError(page)).toContainText(text);
    });
  }

  test("the login page never prints an unknown error code", async ({ page }) => {
    await page.goto("/login?error=%3Cscript%3Ealert(1)%3C/script%3E");

    await expect(loginError(page)).toContainText("Something went wrong");
    await expect(page.locator("body")).not.toContainText("<script>");
  });
});

test.describe("starting the Google flow", () => {
  test("redirects to Google with PKCE and keeps the secrets in httpOnly cookies", async ({
    request,
  }) => {
    const response = await request.get("/api/auth/google", { maxRedirects: 0 });
    expect(response.status()).toBe(307);

    const google = new URL(response.headers()["location"]);
    const params = google.searchParams;
    expect(google.origin + google.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(params.get("client_id")).toBe(E2E_CLIENT_ID);
    expect(params.get("redirect_uri")).toBe("http://localhost:3100/api/auth/callback/google");
    expect(params.get("scope")).toBe("openid email profile");
    expect(params.get("response_type")).toBe("code");
    expect(params.get("code_challenge_method")).toBe("S256");

    const setCookies = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value);
    expect(setCookies).toHaveLength(3);
    for (const cookie of setCookies) {
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=lax/i);
      expect(cookie).toMatch(/Path=\/api\/auth/);
      expect(cookie).toMatch(/Max-Age=600/);
    }

    const valueOf = (name: string) =>
      setCookies.find((cookie) => cookie.startsWith(`${name}=`))!.split(";")[0].split("=")[1];
    expect(valueOf("oauth_state")).toBe(params.get("state"));
    expect(valueOf("oauth_nonce")).toBe(params.get("nonce"));
    // The verifier proves who started the flow, so Google must never see it
    expect(google.toString()).not.toContain(valueOf("oauth_verifier"));
  });
});

test.describe("signing in", () => {
  test("signs the user in, hashes their Google id and keeps the session in the database", async ({
    page,
    context,
  }) => {
    const account = newGoogleAccount("Dana Levi");
    await mockGoogleConsent(page, account);

    await signInWithGoogle(page);

    await expect(page).toHaveURL(/\/dashboard$/);
    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("Dana Levi")).toBeVisible();
    await expect(sidebar.getByRole("button", { name: "Sign out" })).toBeVisible();

    const user = await findUser(account.email);
    expect(user).toBeDefined();
    expect(user!.googleIdHash).toMatch(/^[0-9a-f]{64}$/);
    expect(user!.googleIdHash).not.toContain(account.sub);

    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === "session")!;
    expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
    expect(session.expires * 1000 - Date.now()).toBeGreaterThan(29 * 24 * 3600 * 1000);

    const rows = await sessionsOf(user!.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(session.value);

    // The one-time OAuth cookies are gone
    expect(cookies.filter((c) => c.name.startsWith("oauth_"))).toEqual([]);
  });

  test("stays signed in across reloads and navigation", async ({ page }) => {
    await mockGoogleConsent(page, newGoogleAccount("Dana Levi"));
    await signInWithGoogle(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.reload();
    await expect(page.locator("aside").getByText("Dana Levi")).toBeVisible();

    await page.getByRole("link", { name: "Transactions" }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();

    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("recognises a returning user and refreshes their name", async ({ page }) => {
    const account = newGoogleAccount("Old Name");
    await mockGoogleConsent(page, account);

    await signInWithGoogle(page);
    await expect(page.locator("aside").getByText("Old Name")).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    account.name = "New Name";
    await signInWithGoogle(page);
    await expect(page.locator("aside").getByText("New Name")).toBeVisible();

    expect(await countUsers(account.email)).toBe(1);
    expect((await findUser(account.email))!.name).toBe("New Name");
  });

  test("shows a message when the user cancels on Google", async ({ page }) => {
    const account = { ...newGoogleAccount(), deny: true };
    await mockGoogleConsent(page, account);

    await signInWithGoogle(page);

    await expect(page).toHaveURL(/\/login\?error=access_denied$/);
    await expect(loginError(page)).toContainText("Sign-in was cancelled");
    expect(await findUser(account.email)).toBeUndefined();
  });

  const rejectedTokens: [string, Partial<ReturnType<typeof newGoogleAccount>>][] = [
    ["an unverified email", { emailVerified: false }],
    ["the wrong audience", { claimOverrides: { aud: "another-app" } }],
    ["the wrong issuer", { claimOverrides: { iss: "https://evil.example.com" } }],
    ["an expired token", { claimOverrides: { exp: 1 } }],
    ["a nonce from another login", { claimOverrides: { nonce: "replayed-nonce" } }],
  ];
  for (const [name, overrides] of rejectedTokens) {
    test(`rejects a Google token with ${name}`, async ({ page }) => {
      const account = { ...newGoogleAccount(), ...overrides };
      await mockGoogleConsent(page, account);

      await signInWithGoogle(page);

      await expect(page).toHaveURL(/\/login\?error=google_failed$/);
      await expect(loginError(page)).toContainText("Google sign-in failed");
      expect(await findUser(account.email)).toBeUndefined();
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login$/);
    });
  }
});

test.describe("callback protection", () => {
  // Starts a login the way the browser would, but stops before Google
  async function startFlow(page: Page) {
    const start = await page.request.get("/api/auth/google", { maxRedirects: 0 });
    const google = new URL(start.headers()["location"]);
    const callback = new URL(google.searchParams.get("redirect_uri")!);
    return { callback, state: google.searchParams.get("state")! };
  }

  test("rejects a callback whose state does not match", async ({ page }) => {
    const { callback } = await startFlow(page);
    callback.searchParams.set("code", "anything");
    callback.searchParams.set("state", "attacker-state");

    await page.goto(callback.toString());

    await expect(page).toHaveURL(/\/login\?error=invalid_request$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("rejects a code Google does not accept", async ({ page }) => {
    const { callback, state } = await startFlow(page);
    callback.searchParams.set("code", "not-a-real-code");
    callback.searchParams.set("state", state);

    await page.goto(callback.toString());

    await expect(page).toHaveURL(/\/login\?error=google_failed$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("rejects a callback without the cookies from the start of the flow", async ({ page }) => {
    await page.goto("/api/auth/callback/google?code=anything&state=anything");

    await expect(page).toHaveURL(/\/login\?error=invalid_request$/);
    await expect(loginError(page)).toContainText("invalid or expired");
  });

  test("a used callback link cannot be replayed", async ({ page, context }) => {
    const account = newGoogleAccount();
    const visits = await mockGoogleConsent(page, account);
    await signInWithGoogle(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto(visits[0].callbackUrl);

    await expect(page).toHaveURL(/\/login\?error=invalid_request$/);
    expect((await context.cookies()).some((c) => c.name === "session")).toBe(false);
  });
});

test.describe("session security", () => {
  test("a forged session cookie is not accepted", async ({ page, context }) => {
    await context.addCookies([
      { name: "session", value: "f".repeat(43), url: "http://localhost:3100" },
    ]);

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toHaveCount(0);
  });

  test("an expired session is not accepted", async ({ page }) => {
    const account = newGoogleAccount();
    await mockGoogleConsent(page, account);
    await signInWithGoogle(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await expireSessionsOf((await findUser(account.email))!.id);
    await page.goto("/transactions");

    await expect(page).toHaveURL(/\/login$/);
  });

  test("signing out ends the session on the server, not just in the browser", async ({
    page,
    context,
  }) => {
    const account = newGoogleAccount();
    await mockGoogleConsent(page, account);
    await signInWithGoogle(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    const stolen = (await context.cookies()).find((c) => c.name === "session")!;
    const userId = (await findUser(account.email))!.id;
    expect(await sessionsOf(userId)).toHaveLength(1);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    expect(await sessionsOf(userId)).toHaveLength(0);
    expect((await context.cookies()).some((c) => c.name === "session")).toBe(false);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);

    // Someone who copied the cookie before logout gets nothing either
    await context.addCookies([{ ...stolen }]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("signing out on one device keeps the user signed in on another", async ({
    page,
    browser,
  }) => {
    const account = newGoogleAccount();
    await mockGoogleConsent(page, account);
    await signInWithGoogle(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    const otherContext = await browser.newContext({ baseURL: "http://localhost:3100" });
    await hideNextDevIndicator(otherContext);
    const otherPage = await otherContext.newPage();
    await mockGoogleConsent(otherPage, account);
    await signInWithGoogle(otherPage);
    await expect(otherPage).toHaveURL(/\/dashboard$/);
    expect(await sessionsOf((await findUser(account.email))!.id)).toHaveLength(2);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await otherPage.reload();
    await expect(otherPage.locator("aside").getByText("Dana Levi")).toBeVisible();
    await otherContext.close();
  });
});
