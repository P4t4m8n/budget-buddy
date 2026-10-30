import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { FormState } from "@/lib/validation/form";
import {
  isAppError,
  serializeError,
  type ActionFailure,
} from "./app-error";

// The single place unexpected errors are logged
export const logUnexpected = (error: unknown) => {
  console.error("Unexpected error", error);
};

// Anything that isn't an AppError is unexpected. Next's own control flow, like the
// redirect to /login for signed-out users, passes through untouched; everything else
// is logged once and rethrown, so the user sees the generic error page, never its details.
export const rethrowUnexpected = (error: unknown): never => {
  unstable_rethrow(error);
  logUnexpected(error);
  throw error;
};

// Turns an error caught in a form action into what the form shows: next to the field it
// belongs to, or as a message for the whole form
export const formFailure = <Field extends string>(
  error: unknown,
  values: Record<Field, string>,
): FormState<Field> => {
  if (!isAppError(error)) return rethrowUnexpected(error);

  const base = { status: "error", errorCode: error.code, values } as const;
  return error.field && error.field in values
    ? {
        ...base,
        fieldErrors: { [error.field]: error.message } as Partial<
          Record<Field, string>
        >,
      }
    : { ...base, message: error.message };
};

// Turns an error caught in an action that isn't a form (delete buttons and the like)
export const actionFailure = (error: unknown): ActionFailure => {
  if (!isAppError(error)) return rethrowUnexpected(error);
  return { ok: false, error: serializeError(error) };
};
