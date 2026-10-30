import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/google", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/google")>()),
  getGoogleProfile: vi.fn(),
}));
vi.mock("@/lib/auth/oauth-cookies", () => ({ takeOAuthCookies: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ createSession: vi.fn() }));
vi.mock("@/lib/auth/user", () => ({ upsertGoogleUser: vi.fn() }));

import { GET } from "@/app/api/auth/callback/google/route";
import { getGoogleProfile } from "@/lib/auth/google";
import { takeOAuthCookies } from "@/lib/auth/oauth-cookies";
import { createSession } from "@/lib/auth/session";
import { upsertGoogleUser } from "@/lib/auth/user";
import { AppError } from "@/lib/errors/app-error";

const PROFILE = { sub: "123", email: "dana@example.com", name: "Dana", picture: null };

const callback = (query: string) =>
  GET(new NextRequest(`http://localhost:3000/api/auth/callback/google?${query}`));

const redirectedTo = (response: Response) =>
  new URL(response.headers.get("location")!);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(takeOAuthCookies).mockResolvedValue({
    state: "saved-state",
    nonce: "saved-nonce",
    codeVerifier: "saved-verifier",
  });
  vi.mocked(getGoogleProfile).mockResolvedValue(PROFILE);
  vi.mocked(upsertGoogleUser).mockResolvedValue({ id: "user-1" } as never);
});

describe("GET /api/auth/callback/google", () => {
  it("signs the user in and redirects to the dashboard", async () => {
    const response = await callback("code=abc&state=saved-state");

    expect(redirectedTo(response).pathname).toBe("/dashboard");
    expect(getGoogleProfile).toHaveBeenCalledWith({
      code: "abc",
      codeVerifier: "saved-verifier",
      nonce: "saved-nonce",
      redirectUri: "http://localhost:3000/api/auth/callback/google",
    });
    expect(upsertGoogleUser).toHaveBeenCalledWith(PROFILE);
    expect(createSession).toHaveBeenCalledWith("user-1");
  });

  it("always consumes the one-time OAuth cookies", async () => {
    await callback("code=abc&state=wrong");
    expect(takeOAuthCookies).toHaveBeenCalledOnce();
  });

  it.each([
    ["the user denied access", "error=access_denied&state=saved-state", "access_denied"],
    ["there is no code", "state=saved-state", "invalid_request"],
    ["there is no state", "code=abc", "invalid_request"],
    ["the state doesn't match", "code=abc&state=forged", "invalid_request"],
  ])("fails when %s", async (_name, query, errorCode) => {
    const response = await callback(query);

    expect(redirectedTo(response).pathname).toBe("/login");
    expect(redirectedTo(response).searchParams.get("error")).toBe(errorCode);
    expect(getGoogleProfile).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it.each([
    ["state", { state: undefined, nonce: "n", codeVerifier: "v" }],
    ["nonce", { state: "saved-state", nonce: undefined, codeVerifier: "v" }],
    ["code verifier", { state: "saved-state", nonce: "n", codeVerifier: undefined }],
  ])("fails when the saved %s cookie is missing or expired", async (_name, saved) => {
    vi.mocked(takeOAuthCookies).mockResolvedValue(saved);

    const response = await callback("code=abc&state=saved-state");

    expect(redirectedTo(response).searchParams.get("error")).toBe("invalid_request");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("reports a rejected Google token without creating a session", async () => {
    vi.mocked(getGoogleProfile).mockRejectedValue(AppError.authFailed("Invalid nonce"));

    const response = await callback("code=abc&state=saved-state");

    expect(redirectedTo(response).searchParams.get("error")).toBe("google_failed");
    expect(upsertGoogleUser).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("logs unexpected errors and shows a generic message", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(upsertGoogleUser).mockRejectedValue(new Error("database is down"));

    const response = await callback("code=abc&state=saved-state");

    expect(redirectedTo(response).searchParams.get("error")).toBe("server_error");
    expect(response.headers.get("location")).not.toContain("database");
    expect(createSession).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it("treats an AppError that isn't a sign-in rejection as unexpected here", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(upsertGoogleUser).mockRejectedValue(AppError.notFound("user"));

    const response = await callback("code=abc&state=saved-state");

    expect(redirectedTo(response).searchParams.get("error")).toBe("server_error");
    expect(consoleError).toHaveBeenCalledOnce();
  });
});
