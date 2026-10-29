import type { Decimal } from "@prisma/client/runtime/client";

// Prisma returns Decimal and Date; the UI types use number and "YYYY-MM-DD" strings
export const toNumber = (value: Decimal) => value.toNumber();

export const toDateString = (date: Date) => date.toISOString().slice(0, 10);

// @db.Date columns are stored as UTC midnight
export const fromDateString = (value: string) => new Date(`${value}T00:00:00.000Z`);
