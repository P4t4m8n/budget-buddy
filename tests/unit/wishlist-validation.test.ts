import { describe, expect, it } from "vitest";
import { purchaseInputSchema, wishlistInputSchema } from "@/lib/validation/wishlist";

const valid = { name: "Standing desk", price: "620", priority: "HIGH", status: "WANTED" };

const parse = (overrides: Record<string, unknown> = {}) =>
  wishlistInputSchema.safeParse({ ...valid, ...overrides });

const messageFor = (result: ReturnType<typeof parse>) =>
  result.success ? null : result.error.issues[0].message;

describe("wishlistInputSchema", () => {
  it("accepts a valid item, fills in the currency and turns missing text into null", () => {
    expect(parse().data).toEqual({
      name: "Standing desk",
      price: 620,
      currency: "ILS",
      priority: "HIGH",
      status: "WANTED",
      url: null,
      notes: null,
    });
  });

  describe("name", () => {
    it("is trimmed", () => {
      expect(parse({ name: "  Desk  " }).data?.name).toBe("Desk");
    });

    it.each(["", "   "])("rejects %j", (name) => {
      expect(messageFor(parse({ name }))).toBe("Enter a name");
    });

    it("accepts 80 characters and rejects 81", () => {
      expect(parse({ name: "a".repeat(80) }).success).toBe(true);
      expect(messageFor(parse({ name: "a".repeat(81) }))).toBe("Keep the name under 80 characters");
    });
  });

  describe("price", () => {
    it.each([
      ["620", 620],
      ["0.01", 0.01],
      [" 12.50 ", 12.5],
      ["9999999999.99", 9999999999.99],
      [450, 450],
    ])("accepts %j", (price, expected) => {
      expect(parse({ price }).data?.price).toBe(expected);
    });

    it.each(["", "0", "-5", "abc", "1.234", "1e3", "12345678901"])("rejects %j", (price) => {
      expect(parse({ price }).success).toBe(false);
    });
  });

  describe("priority and status", () => {
    it.each(["LOW", "MEDIUM", "HIGH"])("accepts the priority %s", (priority) => {
      expect(parse({ priority }).data?.priority).toBe(priority);
    });

    it.each(["", "URGENT", "high"])("rejects the priority %j", (priority) => {
      expect(parse({ priority }).success).toBe(false);
    });

    it.each(["WANTED", "SAVING"])("accepts the status %s", (status) => {
      expect(parse({ status }).data?.status).toBe(status);
    });

    it("refuses PURCHASED: only purchasing an item, which records the expense, gets there", () => {
      expect(parse({ status: "PURCHASED" }).success).toBe(false);
    });
  });

  describe("url", () => {
    it.each(["https://example.com/keyboard", "http://example.com", " https://example.com/a?b=c#d "])(
      "accepts %j",
      (url) => {
        expect(parse({ url }).data?.url).toBe(url.trim());
      },
    );

    it.each([undefined, "", "   "])("turns %j into null", (url) => {
      expect(parse({ url }).data?.url).toBeNull();
    });

    it.each([
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "ftp://example.com",
      "file:///etc/passwd",
      "example.com",
      "not a url",
      "//example.com",
    ])("rejects %j: it is rendered as a link", (url) => {
      expect(messageFor(parse({ url }))).toBe("Enter a link starting with http:// or https://");
    });

    it("rejects a link over 2000 characters", () => {
      const url = `https://example.com/${"a".repeat(2000)}`;
      expect(messageFor(parse({ url }))).toBe("Keep the link under 2000 characters");
    });
  });

  describe("notes", () => {
    it("are trimmed, and blank notes become null", () => {
      expect(parse({ notes: "  Waiting for a sale " }).data?.notes).toBe("Waiting for a sale");
      expect(parse({ notes: "   " }).data?.notes).toBeNull();
    });

    it("accepts 500 characters and rejects 501", () => {
      expect(parse({ notes: "a".repeat(500) }).success).toBe(true);
      expect(messageFor(parse({ notes: "a".repeat(501) }))).toBe("Keep the notes under 500 characters");
    });
  });

  it("only allows ILS for now", () => {
    expect(parse({ currency: "USD" }).success).toBe(false);
  });
});

describe("purchaseInputSchema", () => {
  const parsePurchase = (overrides: Record<string, unknown> = {}) =>
    purchaseInputSchema.safeParse({ categoryId: "cat-1", date: "2026-10-29", ...overrides });

  it("accepts a category and a date", () => {
    expect(parsePurchase().data).toEqual({ categoryId: "cat-1", date: "2026-10-29" });
  });

  it("needs a category", () => {
    expect(parsePurchase({ categoryId: "" }).error?.issues[0].message).toBe("Choose a category");
  });

  it.each(["", "2026-13-01", "2026-02-30", "29/10/2026", "not a date"])("rejects the date %j", (date) => {
    expect(parsePurchase({ date }).error?.issues[0].message).toBe("Enter a valid date");
  });
});
