import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { AppError } from "@/lib/errors/app-error";

// Prisma reports "unique constraint failed" (P2002), "foreign key constraint failed" (P2003)
// and so on as numbered errors. What each one means depends on the model, so the caller
// says which AppError to use:
//
//   throw toAppError(error, { P2002: () => AppError.duplicate("...", "name") });
//
// Returns the AppError for a mapped code, or the original error when there is no mapping.
export const toAppError = (
  error: unknown,
  mapping: Partial<Record<string, () => AppError>>,
): unknown => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return error;

  const appError = mapping[error.code]?.();
  if (!appError) return error;

  appError.cause = error;
  return appError;
};
