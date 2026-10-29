import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stand-in for the browser's cookie jar
const jar = new Map<string, string>();
const cookieOptions = new Map<string, Record<string, unknown>>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string, options: Record<string, unknown> = {}) => {
      jar.set(name, value);
      cookieOptions.set(name, options);
    },
    delete: (name: string) => jar.delete(name),
  }),
}));

import { hashGoogleId, hashToken } from "@/lib/auth/crypto";
import { createSession, deleteSession, getSession } from "@/lib/auth/session";
import { upsertGoogleUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";

const EMAIL_DOMAIN = "@integration.test";
const DAY_MS = 24 * 60 * 60 * 1000;

const profile = (sub: string, overrides: Partial<{ name: string | null; picture: string | null }> = {}) => ({
  sub,
  email: `${sub}${EMAIL_DOMAIN}`,
  name: "Dana Levi",
  picture: null,
  ...overrides,
});

beforeEach(() => {
  jar.clear();
  cookieOptions.clear();
});

// Only ever removes rows these tests created; sessions go with their users (cascade)
afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("upsertGoogleUser", () => {
  it("creates a user and stores only a keyed hash of the Google id", async () => {
    const user = await upsertGoogleUser(profile("g-1001"));

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.googleIdHash).toBe(hashGoogleId("g-1001"));
    expect(row.googleIdHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.googleIdHash).not.toContain("g-1001");
    expect(row.email).toBe(`g-1001${EMAIL_DOMAIN}`);
  });

  it("recognises a returning user and refreshes their profile instead of duplicating them", async () => {
    const first = await upsertGoogleUser(profile("g-2001", { name: "Old Name" }));
    const second = await upsertGoogleUser(
      profile("g-2001", { name: "New Name", picture: "https://example.com/p.png" }),
    );

    expect(second.id).toBe(first.id);
    expect(second.name).toBe("New Name");
    expect(second.image).toBe("https://example.com/p.png");
    expect(await prisma.user.count({ where: { googleIdHash: hashGoogleId("g-2001") } })).toBe(1);
  });

  it("keeps different Google accounts separate", async () => {
    const a = await upsertGoogleUser(profile("g-3001"));
    const b = await upsertGoogleUser(profile("g-3002"));
    expect(a.id).not.toBe(b.id);
  });

  it("is enforced by the database: two users can't share a Google id hash", async () => {
    await upsertGoogleUser(profile("g-4001"));

    await expect(
      prisma.user.create({
        data: { email: `other${EMAIL_DOMAIN}`, googleIdHash: hashGoogleId("g-4001") },
      }),
    ).rejects.toThrow();
  });
});

describe("createSession", () => {
  it("stores only the hash of the cookie token", async () => {
    const user = await upsertGoogleUser(profile("g-5001"));
    await createSession(user.id);

    const token = jar.get("session")!;
    const rows = await prisma.session.findMany({ where: { userId: user.id } });

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(token));
    expect(rows[0].tokenHash).not.toBe(token);
  });

  it("sets a hardened cookie that expires with the session", async () => {
    const user = await upsertGoogleUser(profile("g-5002"));
    await createSession(user.id);

    const [row] = await prisma.session.findMany({ where: { userId: user.id } });
    const options = cookieOptions.get("session")!;

    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect((options.expires as Date).getTime()).toBe(row.expiresAt.getTime());
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * DAY_MS);
    expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30 * DAY_MS);
  });

  it("allows several sessions for one user, for example two devices", async () => {
    const user = await upsertGoogleUser(profile("g-5003"));
    await createSession(user.id);
    const firstToken = jar.get("session");
    await createSession(user.id);

    expect(jar.get("session")).not.toBe(firstToken);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);
  });

  it("cleans up expired sessions of any user", async () => {
    const stale = await upsertGoogleUser(profile("g-5004"));
    const fresh = await upsertGoogleUser(profile("g-5005"));
    await prisma.session.create({
      data: { userId: stale.id, tokenHash: "expired-hash", expiresAt: new Date(Date.now() - 1000) },
    });

    await createSession(fresh.id);

    expect(await prisma.session.count({ where: { tokenHash: "expired-hash" } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: fresh.id } })).toBe(1);
  });
});

describe("getSession", () => {
  it("returns the signed-in user, and nothing sensitive", async () => {
    const user = await upsertGoogleUser(profile("g-6001", { picture: "https://example.com/a.png" }));
    await createSession(user.id);

    const session = await getSession();

    expect(session?.user).toEqual({
      id: user.id,
      email: `g-6001${EMAIL_DOMAIN}`,
      name: "Dana Levi",
      image: "https://example.com/a.png",
    });
  });

  it("returns null when there is no cookie", async () => {
    expect(await getSession()).toBeNull();
  });

  it("returns null for a cookie that was never issued", async () => {
    jar.set("session", "forged-token-that-is-not-in-the-database");
    expect(await getSession()).toBeNull();
  });

  it("returns null for a tampered token", async () => {
    const user = await upsertGoogleUser(profile("g-6002"));
    await createSession(user.id);
    const token = jar.get("session")!;
    jar.set("session", `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`);

    expect(await getSession()).toBeNull();
  });

  it("does not accept the stored hash as a token", async () => {
    const user = await upsertGoogleUser(profile("g-6003"));
    await createSession(user.id);
    const [row] = await prisma.session.findMany({ where: { userId: user.id } });
    jar.set("session", row.tokenHash);

    expect(await getSession()).toBeNull();
  });

  it("returns null once the session has expired", async () => {
    const user = await upsertGoogleUser(profile("g-6004"));
    await createSession(user.id);
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await getSession()).toBeNull();
  });
});

describe("deleteSession", () => {
  it("removes this session and the cookie, but not the user's other sessions", async () => {
    const user = await upsertGoogleUser(profile("g-7001"));
    await createSession(user.id);
    const otherDeviceToken = jar.get("session")!;
    await createSession(user.id);

    await deleteSession();

    expect(jar.has("session")).toBe(false);
    expect(await getSession()).toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);

    jar.set("session", otherDeviceToken);
    expect((await getSession())?.user.id).toBe(user.id);
  });

  it("does nothing when nobody is signed in", async () => {
    await expect(deleteSession()).resolves.toBeUndefined();
  });
});

describe("account removal", () => {
  it("deletes a user's sessions together with the user", async () => {
    const user = await upsertGoogleUser(profile("g-8001"));
    await createSession(user.id);

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await getSession()).toBeNull();
  });
});
