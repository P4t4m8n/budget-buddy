import type { AppErrorCode } from "@/lib/errors/errors.type";

// For toMatchObject / rejects.toMatchObject: "is an AppError with this code"
export const appError = (code: AppErrorCode) => ({ name: "AppError", code });
