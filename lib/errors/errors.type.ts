// The one error type for things that can go wrong on purpose: the user asked for something
// the app refuses to do. Its message is always safe to show to the user. Anything that is
// not an AppError is a bug or an outage, and is never shown.
export type AppErrorCode =
  | "NOT_FOUND" // the item doesn't exist, or isn't the signed-in user's
  | "DUPLICATE" // it would collide with something that already exists
  | "IN_USE" // it can't be removed while something still depends on it
  | "INVALID_REFERENCE" // it points at something that doesn't exist, isn't theirs, or doesn't fit
  | "INVALID_INPUT" // what was submitted isn't acceptable, for a reason that isn't a single form field
  | "AUTH_FAILED"; // sign-in was rejected

export type AppErrorOptions = {
  // The form field the message belongs next to
  field?: string;
  // Numbers the UI needs to explain the error, for example how many rows still use something
  details?: Record<string, number>;
  cause?: unknown;
};

// What a Server Action can send to the browser: plain data, no class instances
export type SerializedError = {
  code: AppErrorCode;
  message: string;
  details?: Record<string, number>;
};

export type ActionFailure = { ok: false; error: SerializedError };
export type ActionResult = { ok: true } | ActionFailure;