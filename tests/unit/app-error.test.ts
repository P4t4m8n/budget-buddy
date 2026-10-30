import { Prisma } from "@/generated/prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AppError,
  isAppError,
  serializeError,
} from "@/lib/errors/app-error";
import {
  actionFailure,
  formFailure,
  logUnexpected,
  rethrowUnexpected,
} from "@/lib/errors/handle";
import { toAppError } from "@/lib/data/prisma-errors";
import { redirectError } from "../setup/redirect-error";

afterEach(() => vi.restoreAllMocks());

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("database said no", {
    code,
    clientVersion: "test",
  });

describe("AppError", () => {
  it("is an Error with a code, and a message that is safe to show", () => {
    const error = new AppError("DUPLICATE", "Already there", { field: "name" });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe("AppError");
    expect(error).toMatchObject({ code: "DUPLICATE", message: "Already there", field: "name" });
    expect(error.stack).toBeDefined();
  });

  it("keeps the original error as its cause", () => {
    const cause = new Error("root cause");

    expect(new AppError("NOT_FOUND", "gone", { cause }).cause).toBe(cause);
  });

  it.each([
    [AppError.notFound("category"), "NOT_FOUND", "This category no longer exists. It may have been deleted in another tab."],
    [AppError.duplicate("Taken", "name"), "DUPLICATE", "Taken"],
    [AppError.inUse("In use", { transactions: 2 }), "IN_USE", "In use"],
    [AppError.invalidReference("Pick another", "categoryId"), "INVALID_REFERENCE", "Pick another"],
    [AppError.authFailed("Bad token"), "AUTH_FAILED", "Bad token"],
  ])("has a factory for %s", (error, code, message) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code, message });
  });

  it("carries the field and details through the factories", () => {
    expect(AppError.duplicate("Taken", "name").field).toBe("name");
    expect(AppError.invalidReference("Pick another", "categoryId").field).toBe("categoryId");
    expect(AppError.inUse("In use", { transactions: 2, budgets: 1 }).details).toEqual({
      transactions: 2,
      budgets: 1,
    });
  });
});

describe("isAppError", () => {
  it("recognises AppErrors only", () => {
    expect(isAppError(AppError.notFound("category"))).toBe(true);
    expect(isAppError(new Error("plain"))).toBe(false);
    expect(isAppError({ code: "NOT_FOUND", name: "AppError" })).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError("NOT_FOUND")).toBe(false);
  });
});

describe("serializeError", () => {
  it("keeps only what the browser needs, as plain data", () => {
    const error = AppError.inUse("In use", { transactions: 2, budgets: 0 });
    error.cause = new Error("internal detail");

    const serialized = serializeError(error);

    expect(serialized).toEqual({
      code: "IN_USE",
      message: "In use",
      details: { transactions: 2, budgets: 0 },
    });
    expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
    expect(JSON.stringify(serialized)).not.toContain("internal detail");
    expect(serialized).not.toHaveProperty("stack");
  });
});

describe("toAppError", () => {
  const mapping = {
    P2002: () => AppError.duplicate("Already exists", "name"),
    P2003: () => AppError.inUse("Still used"),
  };

  it("turns a mapped Prisma error into its AppError and keeps the Prisma error as the cause", () => {
    const original = prismaError("P2002");

    const result = toAppError(original, mapping);

    expect(result).toBeInstanceOf(AppError);
    expect(result).toMatchObject({ code: "DUPLICATE", field: "name" });
    expect((result as AppError).cause).toBe(original);
  });

  it("picks the mapping for the code that happened", () => {
    expect(toAppError(prismaError("P2003"), mapping)).toMatchObject({ code: "IN_USE" });
  });

  it("returns a Prisma error without a mapping unchanged", () => {
    const original = prismaError("P2025");

    expect(toAppError(original, mapping)).toBe(original);
  });

  it("returns errors that aren't from Prisma unchanged", () => {
    const plain = new Error("connection lost");
    const appError = AppError.notFound("category");

    expect(toAppError(plain, mapping)).toBe(plain);
    expect(toAppError(appError, mapping)).toBe(appError);
    expect(toAppError("a string", mapping)).toBe("a string");
  });
});

describe("rethrowUnexpected", () => {
  it("logs a real error once and rethrows it", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("boom");

    expect(() => rethrowUnexpected(failure)).toThrow(failure);
    expect(consoleError).toHaveBeenCalledExactlyOnceWith("Unexpected error", failure);
  });

  it("lets Next's own control flow through without logging it", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const redirect = redirectError();

    expect(() => rethrowUnexpected(redirect)).toThrow();
    try {
      rethrowUnexpected(redirect);
    } catch (error) {
      expect(error).toBe(redirect);
    }
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("logUnexpected", () => {
  it("is the one place unexpected errors are logged", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("boom");

    logUnexpected(failure);

    expect(consoleError).toHaveBeenCalledExactlyOnceWith("Unexpected error", failure);
  });
});

describe("formFailure", () => {
  const values = { name: "Groceries", color: "#fff" };

  it("puts a field error next to its field", () => {
    expect(formFailure(AppError.duplicate("Taken", "name"), values)).toEqual({
      status: "error",
      errorCode: "DUPLICATE",
      fieldErrors: { name: "Taken" },
      values,
    });
  });

  it("shows an error without a field as a message for the whole form", () => {
    expect(formFailure(AppError.notFound("category"), values)).toEqual({
      status: "error",
      errorCode: "NOT_FOUND",
      message: "This category no longer exists. It may have been deleted in another tab.",
      values,
    });
  });

  it("falls back to a form message when the field isn't in this form", () => {
    const result = formFailure(AppError.duplicate("Taken", "somethingElse"), values);

    expect(result.fieldErrors).toBeUndefined();
    expect(result.message).toBe("Taken");
  });

  it("never swallows a plain error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("boom");

    expect(() => formFailure(failure, values)).toThrow(failure);
  });

  it("never swallows the redirect for signed-out users", () => {
    const redirect = redirectError();

    expect(() => formFailure(redirect, values)).toThrow();
    try {
      formFailure(redirect, values);
    } catch (error) {
      expect(error).toBe(redirect);
    }
  });
});

describe("actionFailure", () => {
  it("returns a plain, serializable failure", () => {
    const result = actionFailure(AppError.inUse("Still used", { transactions: 3 }));

    expect(result).toEqual({
      ok: false,
      error: { code: "IN_USE", message: "Still used", details: { transactions: 3 } },
    });
  });

  it("never swallows a plain error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("boom");

    expect(() => actionFailure(failure)).toThrow(failure);
  });
});
