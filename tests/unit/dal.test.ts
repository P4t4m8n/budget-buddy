import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

import { getCurrentUser, requireUser } from "@/lib/auth/dal";
import { getSession } from "@/lib/auth/session";

const USER = { id: "user-1", email: "dana@example.com", name: "Dana", image: null };

beforeEach(() => vi.mocked(getSession).mockReset());

describe("getCurrentUser", () => {
  it("returns the user of a valid session", async () => {
    vi.mocked(getSession).mockResolvedValue({ id: "s1", expiresAt: new Date(), user: USER });
    expect(await getCurrentUser()).toEqual(USER);
  });

  it("returns null without a session", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("requireUser", () => {
  it("returns the user of a valid session", async () => {
    vi.mocked(getSession).mockResolvedValue({ id: "s1", expiresAt: new Date(), user: USER });
    expect(await requireUser()).toEqual(USER);
  });

  it("redirects to /login without a session", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});
