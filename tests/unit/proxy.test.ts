import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });

const passesThrough = (response: Response) =>
  response.headers.get("x-middleware-next") === "1";

describe("proxy", () => {
  it.each(["/", "/dashboard", "/transactions", "/budget", "/savings", "/wishlist"])(
    "redirects %s to /login without a session cookie",
    (path) => {
      const response = proxy(request(path));
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
    },
  );

  it("lets pages through when a session cookie is present", () => {
    expect(passesThrough(proxy(request("/dashboard", "session=abc")))).toBe(true);
  });

  it("ignores an empty session cookie", () => {
    expect(proxy(request("/dashboard", "session=")).status).toBe(307);
  });

  it("ignores other cookies", () => {
    expect(proxy(request("/dashboard", "theme=dark")).status).toBe(307);
  });

  it.each(["/login", "/api/auth/google", "/api/auth/callback/google", "/api/auth/logout"])(
    "keeps %s public",
    (path) => {
      expect(passesThrough(proxy(request(path)))).toBe(true);
    },
  );

  it("answers other API routes with 401 JSON instead of a redirect", async () => {
    const response = proxy(request("/api/transactions"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("lets API routes through with a session cookie", () => {
    expect(passesThrough(proxy(request("/api/transactions", "session=abc")))).toBe(true);
  });

  it("is not fooled by paths that only look like the public ones", () => {
    expect(proxy(request("/api/authorize")).status).toBe(401);
    expect(proxy(request("/login/anything")).status).toBe(307);
  });
});

describe("proxy matcher", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it.each(["/", "/dashboard", "/login", "/api/auth/google", "/api/transactions"])(
    "runs on %s",
    (path) => expect(matcher.test(path)).toBe(true),
  );

  it.each(["/_next/static/chunks/app.js", "/_next/image", "/favicon.ico", "/logo.png", "/icon.svg"])(
    "skips %s",
    (path) => expect(matcher.test(path)).toBe(false),
  );
});
