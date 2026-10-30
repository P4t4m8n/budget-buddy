import type { AppErrorCode } from "@/lib/errors/app-error";

// For toMatchObject / rejects.toMatchObject: "is an AppError with this code"
export const appError = (code: AppErrorCode) => ({ name: "AppError", code });
