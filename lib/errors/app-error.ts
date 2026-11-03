import { AppErrorCode, AppErrorOptions, SerializedError } from "./errors.type";

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

  static invalidInput = (message: string) =>
    new AppError("INVALID_INPUT", message);

  static authFailed = (message: string) => new AppError("AUTH_FAILED", message);
}

export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError;



export const serializeError = ({
  code,
  message,
  details,
}: AppError): SerializedError => ({ code, message, details });
