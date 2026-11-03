import type { Cell } from "./types";

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
// Decimal(12, 2): up to 10 digits before the decimal point
export const MAX_AMOUNT = 9_999_999_999.99;

const pad = (value: number) => String(value).padStart(2, "0");

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

// A real calendar day in a sensible range, or null. "31/02/2026" and "12/13/2026" are not days.
const toIsoDate = (year: number, month: number, day: number) => {
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
};

// Spreadsheets count days from 1899-12-30 (a day number is what a date cell really holds)
const EXCEL_EPOCH_OFFSET_DAYS = 25569; // days between 1899-12-30 and 1970-01-01

const fromDate = (date: Date) =>
  Number.isNaN(date.getTime())
    ? null
    : // Dates from a spreadsheet are UTC midnight of the day shown
      toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());

// A day number from a spreadsheet's date cell that was read as a plain number
const fromSerial = (serial: number) =>
  Number.isFinite(serial)
    ? fromDate(new Date(Math.round((serial - EXCEL_EPOCH_OFFSET_DAYS) * 86_400_000)))
    : null;

const TIME_SUFFIX = String.raw`(?:[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?`;
const YEAR_FIRST = new RegExp(String.raw`^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})${TIME_SUFFIX}$`);
const DAY_FIRST = new RegExp(String.raw`^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})${TIME_SUFFIX}$`);

// The day in a date cell, as "YYYY-MM-DD", or null when it isn't one. Text dates are read as
// day/month/year (31/10/2026, 31.10.26) or year-month-day (2026-10-31), never month/day,
// so a file that uses month/day shows up as unreadable instead of silently getting wrong dates.
export const parseDateCell = (cell: Cell): string | null => {
  if (cell instanceof Date) return fromDate(cell);
  if (typeof cell === "number") return fromSerial(cell);
  if (typeof cell !== "string") return null;

  const text = cell.trim();

  const yearFirst = YEAR_FIRST.exec(text);
  if (yearFirst) {
    return toIsoDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));
  }

  const dayFirst = DAY_FIRST.exec(text);
  if (dayFirst) {
    const year = dayFirst[3].length === 2 ? 2000 + Number(dayFirst[3]) : Number(dayFirst[3]);
    return toIsoDate(year, Number(dayFirst[2]), Number(dayFirst[1]));
  }

  return null;
};

const roundToCents = (value: number) => Math.round(value * 100) / 100;

// Currency names and symbols, spaces (including non-breaking ones) and the invisible
// left-to-right and right-to-left marks that Hebrew exports carry
const NOISE = /[\s\u00a0\u200e\u200f\u202a-\u202e₪$€£+]|ש"ח|שח|NIS|ILS|USD|EUR/gi;
// Signs and brackets say whether it is money in or out; every row is an expense here, so
// only the size of the amount matters
const SIGNS = /[-\u2212\u2013\u2014()]/g;

// "1,234.56", "1.234,56", "1 234,56", "12,5", "₪ 45", "(120.00)" and "-45.5" are all amounts
const parseAmountText = (raw: string): number | null => {
  const text = raw.replace(NOISE, "").replace(SIGNS, "");
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normalised: string;

  if (lastComma !== -1 && lastDot !== -1) {
    // Both are there: whichever comes last is the decimal point, the other groups thousands
    const decimal = lastComma > lastDot ? "," : ".";
    const group = decimal === "," ? "." : ",";
    const [whole, fraction] = text.split(decimal);
    // Anything else ("1.2.3,4", "1,234,56.7,8") isn't a number written with grouping
    const grouped = new RegExp(`^\\d{1,3}(\\${group}\\d{3})+$`);
    if (text.split(decimal).length !== 2 || !grouped.test(whole) || !/^\d+$/.test(fraction)) {
      return null;
    }
    normalised = `${whole.split(group).join("")}.${fraction}`;
  } else if (lastComma !== -1) {
    // "1,234" and "1,234,567" are thousands; "12,5" and "12,50" have a decimal comma
    normalised = /^\d{1,3}(,\d{3})+$/.test(text)
      ? text.replace(/,/g, "")
      : /^\d+,\d{1,2}$/.test(text)
        ? text.replace(",", ".")
        : "";
  } else if (lastDot !== -1) {
    // Two or more dots are thousands ("1.234.567"); one is the decimal point
    normalised =
      text.indexOf(".") === lastDot
        ? text
        : /^\d{1,3}(\.\d{3})+$/.test(text)
          ? text.replace(/\./g, "")
          : "";
  } else {
    normalised = text;
  }

  const value = Number(normalised);
  return normalised !== "" && Number.isFinite(value) ? roundToCents(value) : null;
};

// The size of the amount in a cell, always positive, or null when it isn't an amount.
// Zero is a valid reading: the caller decides what to do with it.
export const parseAmountCell = (cell: Cell): number | null => {
  if (typeof cell === "number") {
    return Number.isFinite(cell) ? roundToCents(Math.abs(cell)) : null;
  }
  if (typeof cell !== "string") return null;
  return parseAmountText(cell);
};
