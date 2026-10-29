import { afterEach, describe, expect, it } from "vitest";
import {
  hashGoogleId,
  hashToken,
  pkceChallenge,
  randomToken,
  safeEqual,
} from "@/lib/auth/crypto";

describe("randomToken", () => {
  it("returns url-safe tokens of 256 bits by default", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => randomToken()));
    expect(tokens.size).toBe(200);
  });
});

describe("hashToken", () => {
  it("is SHA-256 hex", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("is deterministic and does not return its input", () => {
    const token = randomToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
  });
});

describe("hashGoogleId", () => {
  const originalSecret = process.env.AUTH_SECRET;
  afterEach(() => {
    process.env.AUTH_SECRET = originalSecret;
  });

  it("is a deterministic 64 character hex string that hides the raw id", () => {
    const hash = hashGoogleId("110169484474386276334");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashGoogleId("110169484474386276334"));
    expect(hash).not.toContain("110169484474386276334");
  });

  it("gives different hashes for different ids", () => {
    expect(hashGoogleId("1")).not.toBe(hashGoogleId("2"));
  });

  it("depends on AUTH_SECRET, so it can't be recomputed without it", () => {
    const before = hashGoogleId("42");
    process.env.AUTH_SECRET = "a-different-secret";
    expect(hashGoogleId("42")).not.toBe(before);
  });

  it("throws when AUTH_SECRET is missing", () => {
    delete process.env.AUTH_SECRET;
    expect(() => hashGoogleId("42")).toThrow("AUTH_SECRET");
  });
});

describe("pkceChallenge", () => {
  it("matches the RFC 7636 test vector", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});

describe("safeEqual", () => {
  it("compares strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });

  it("returns false for different lengths instead of throwing", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "a")).toBe(false);
  });
});
