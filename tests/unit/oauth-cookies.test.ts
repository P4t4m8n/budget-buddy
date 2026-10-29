import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
const set = vi.fn((name: string, value: string, options?: { maxAge?: number }) => {
  if (options?.maxAge === 0) store.delete(name);
  else store.set(name, value);
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (store.has(name) ? { name, value: store.get(name) } : undefined),
    set,
  }),
}));

import { setOAuthCookies, takeOAuthCookies } from "@/lib/auth/oauth-cookies";

const values = { state: "s-123", nonce: "n-456", codeVerifier: "v-789" };

beforeEach(() => {
  store.clear();
  set.mockClear();
});

describe("setOAuthCookies", () => {
  it("stores the three values in short-lived httpOnly cookies scoped to /api/auth", async () => {
    await setOAuthCookies(values);

    expect(Object.fromEntries(store)).toEqual({
      oauth_state: "s-123",
      oauth_nonce: "n-456",
      oauth_verifier: "v-789",
    });
    for (const [, , options] of set.mock.calls) {
      expect(options).toMatchObject({
        httpOnly: true,
        sameSite: "lax",
        path: "/api/auth",
        maxAge: 600,
      });
    }
  });
});

describe("takeOAuthCookies", () => {
  it("returns the saved values and clears them so a login attempt can't be replayed", async () => {
    await setOAuthCookies(values);

    expect(await takeOAuthCookies()).toEqual(values);
    expect(store.size).toBe(0);
    expect(await takeOAuthCookies()).toEqual({
      state: undefined,
      nonce: undefined,
      codeVerifier: undefined,
    });
  });
});
