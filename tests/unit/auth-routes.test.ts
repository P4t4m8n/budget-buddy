import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/oauth-cookies", () => ({ setOAuthCookies: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ deleteSession: vi.fn() }));

import * as logoutRoute from "@/app/api/auth/logout/route";
import { GET as startLogin } from "@/app/api/auth/google/route";
import { setOAuthCookies } from "@/lib/auth/oauth-cookies";
import { deleteSession } from "@/lib/auth/session";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/auth/google", () => {
  it("redirects to Google and remembers state, nonce and verifier", async () => {
    const response = await startLogin(new NextRequest("http://localhost:3000/api/auth/google"));

    const location = new URL(response.headers.get("location")!);
    expect(response.status).toBe(307);
    expect(location.origin + location.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback/google",
    );

    expect(setOAuthCookies).toHaveBeenCalledWith({
      state: location.searchParams.get("state"),
      nonce: location.searchParams.get("nonce"),
      codeVerifier: expect.any(String),
    });
  });

  it("builds the redirect URI from the request origin", async () => {
    const response = await startLogin(new NextRequest("http://localhost:3100/api/auth/google"));

    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3100/api/auth/callback/google",
    );
  });
});

describe("POST /api/auth/logout", () => {
  it("deletes the session and sends the user to /login with a GET", async () => {
    const response = await logoutRoute.POST(
      new NextRequest("http://localhost:3000/api/auth/logout", { method: "POST" }),
    );

    expect(deleteSession).toHaveBeenCalledOnce();
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("is POST only, so another site can't log you out with a link or image", () => {
    expect(Object.keys(logoutRoute)).toEqual(["POST"]);
  });
});
