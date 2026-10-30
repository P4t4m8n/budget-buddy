// The one error type for things that can go wrong on purpose: the user asked for something
// the app refuses to do. Its message is always safe to show to the user. Anything that is
// not an AppError is a bug or an outage, and is never shown.
export type AppErrorCode =
  | "NOT_FOUND" // the item doesn't exist, or isn't the signed-in user's
  | "DUPLICATE" // it would collide with something that already exists
  | "IN_USE" // it can't be removed while something still depends on it
  | "INVALID_REFERENCE" // it points at something that doesn't exist, isn't theirs, or doesn't fit
  | "AUTH_FAILED"; // sign-in was rejected

type AppErrorOptions = {
  // The form field the message belongs next to
  field?: string;
  // Numbers the UI needs to explain the error, for example how many rows still use something
  details?: Record<string, number>;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly field?: string;
  readonly details?: Record<string, number>;

  constructor(
    code: AppErrorCode,
    message: string,
    { field, details, cause }: AppErrorOptions = {},
  ) {
    super(message, { cause });
    this.name = "AppError";
    this.code = code;
    this.field = field;
    this.details = details;
  }

  // `what` is a lower-case noun: "category", "transaction"
  static notFound = (what: string) =>
    new AppError(
      "NOT_FOUND",
      `This ${what} no longer exists. It may have been deleted in another tab.`,
    );

  static duplicate = (message: string, field?: string) =>
    new AppError("DUPLICATE", message, { field });

  static inUse = (message: string, details?: Record<string, number>) =>
    new AppError("IN_USE", message, { details });

  static invalidReference = (message: string, field?: string) =>
    new AppError("INVALID_REFERENCE", message, { field });

  static authFailed = (message: string) =>
    new AppError("AUTH_FAILED", message);
}

export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError;

// What a Server Action can send to the browser: plain data, no class instances
export type SerializedError = {
  code: AppErrorCode;
  message: string;
  details?: Record<string, number>;
};

export type ActionFailure = { ok: false; error: SerializedError };
export type ActionResult = { ok: true } | ActionFailure;

export const serializeError = ({
  code,
  message,
  details,
}: AppError): SerializedError => ({ code, message, details });
