import { afterEach, describe, expect, it, vi } from "vitest";
import { pkceChallenge } from "@/lib/auth/crypto";
import {
  GoogleAuthError,
  createAuthorizationRequest,
  getGoogleProfile,
  googleRedirectUri,
  isValidState,
} from "@/lib/auth/google";

const REDIRECT_URI = "http://localhost:3000/api/auth/callback/google";
const NONCE = "expected-nonce";

const base64url = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

function idToken(overrides: Record<string, unknown> = {}) {
  const claims = {
    iss: "https://accounts.google.com",
    aud: "unit-client-id",
    exp: Math.floor(Date.now() / 1000) + 300,
    nonce: NONCE,
    sub: "1234567890",
    email: "dana@example.com",
    email_verified: true,
    name: "Dana Levi",
    picture: "https://example.com/dana.png",
    ...overrides,
  };
  return `${base64url({ alg: "RS256" })}.${base64url(claims)}.signature`;
}

function mockTokenResponse(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const exchange = () =>
  getGoogleProfile({ code: "auth-code", codeVerifier: "verifier", nonce: NONCE, redirectUri: REDIRECT_URI });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("googleRedirectUri", () => {
  it("builds the callback URL from an origin", () => {
    expect(googleRedirectUri("http://localhost:3000")).toBe(REDIRECT_URI);
  });
});

describe("createAuthorizationRequest", () => {
  it("builds a Google URL with PKCE, state and nonce", () => {
    const { url, state, nonce, codeVerifier } = createAuthorizationRequest(REDIRECT_URI);
    const { origin, pathname, searchParams } = new URL(url);

    expect(origin + pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(searchParams.get("client_id")).toBe("unit-client-id");
    expect(searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(searchParams.get("response_type")).toBe("code");
    expect(searchParams.get("scope")).toBe("openid email profile");
    expect(searchParams.get("state")).toBe(state);
    expect(searchParams.get("nonce")).toBe(nonce);
    expect(searchParams.get("code_challenge_method")).toBe("S256");
    expect(searchParams.get("code_challenge")).toBe(pkceChallenge(codeVerifier));
  });

  it("never sends the code verifier or client secret to Google", () => {
    const { url, codeVerifier } = createAuthorizationRequest(REDIRECT_URI);
    expect(url).not.toContain(codeVerifier);
    expect(url).not.toContain("unit-client-secret");
  });

  it("uses fresh random values every time", () => {
    const a = createAuthorizationRequest(REDIRECT_URI);
    const b = createAuthorizationRequest(REDIRECT_URI);
    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });
});

describe("isValidState", () => {
  it("accepts only an exact match", () => {
    expect(isValidState("abc", "abc")).toBe(true);
    expect(isValidState("abc", "abd")).toBe(false);
  });

  it("rejects missing values", () => {
    expect(isValidState(null, "abc")).toBe(false);
    expect(isValidState("abc", undefined)).toBe(false);
    expect(isValidState("", "")).toBe(false);
  });
});

describe("getGoogleProfile", () => {
  it("returns the profile for a valid token", async () => {
    mockTokenResponse({ id_token: idToken() });

    await expect(exchange()).resolves.toEqual({
      sub: "1234567890",
      email: "dana@example.com",
      name: "Dana Levi",
      picture: "https://example.com/dana.png",
    });
  });

  it("accepts the bare accounts.google.com issuer", async () => {
    mockTokenResponse({ id_token: idToken({ iss: "accounts.google.com" }) });
    await expect(exchange()).resolves.toMatchObject({ sub: "1234567890" });
  });

  it("returns null for missing optional name and picture", async () => {
    mockTokenResponse({ id_token: idToken({ name: undefined, picture: undefined }) });
    await expect(exchange()).resolves.toMatchObject({ name: null, picture: null });
  });

  it("sends the code, verifier and credentials to Google's token endpoint", async () => {
    const fetchMock = mockTokenResponse({ id_token: idToken() });
    await exchange();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = new URLSearchParams(init.body as URLSearchParams);

    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.method).toBe("POST");
    expect(Object.fromEntries(body)).toEqual({
      code: "auth-code",
      code_verifier: "verifier",
      client_id: "unit-client-id",
      client_secret: "unit-client-secret",
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    });
  });

  it.each([
    ["wrong audience", { aud: "someone-elses-client" }, "Invalid audience"],
    ["wrong issuer", { iss: "https://evil.example.com" }, "Invalid issuer"],
    ["expired token", { exp: 1 }, "Token expired"],
    ["missing expiry", { exp: undefined }, "Token expired"],
    ["wrong nonce", { nonce: "another-nonce" }, "Invalid nonce"],
    ["missing nonce", { nonce: undefined }, "Invalid nonce"],
    ["unverified email", { email_verified: false }, "Email is not verified"],
    ["email_verified as a string", { email_verified: "true" }, "Email is not verified"],
    ["missing sub", { sub: undefined }, "Missing claims"],
    ["missing email", { email: undefined }, "Missing claims"],
  ])("rejects a token with %s", async (_name, overrides, message) => {
    mockTokenResponse({ id_token: idToken(overrides) });

    const error = await exchange().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GoogleAuthError);
    expect((error as Error).message).toBe(message);
  });

  it("rejects when Google refuses the code", async () => {
    mockTokenResponse({ error: "invalid_grant" }, 400);
    await expect(exchange()).rejects.toThrow("Google token exchange failed");
  });

  it("rejects when Google returns no id_token", async () => {
    mockTokenResponse({ access_token: "only-an-access-token" });
    await expect(exchange()).rejects.toThrow("no id_token");
  });

  it.each(["not-a-jwt", "a.%%%.c", `a.${Buffer.from("not json").toString("base64url")}.c`])(
    "rejects a malformed id_token (%s)",
    async (malformed) => {
      mockTokenResponse({ id_token: malformed });
      await expect(exchange()).rejects.toBeInstanceOf(GoogleAuthError);
    },
  );
});
