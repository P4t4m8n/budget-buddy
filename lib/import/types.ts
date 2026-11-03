// What a spreadsheet cell can hold once it has been read: text from a CSV, or numbers and
// dates from a real spreadsheet
export type Cell = string | number | boolean | Date | null | undefined;

// A sheet as rows of cells, in the order they appear in the file
export type Table = Cell[][];

// Which column (a 0-based index) holds each of the things an imported row needs
export type ColumnMapping = {
  date: number | null;
  description: number | null;
  amount: number | null;
};

// One row of the file, ready to be given a category. Every row is an expense, so the
// amount is always positive.
export type ImportRow = {
  // The row's number in the file, as a spreadsheet shows it (1 is the first row)
  sourceRow: number;
  date: string; // "YYYY-MM-DD"
  description: string;
  amount: number;
};

// A row of the file that can't be imported, and why
export type SkippedRow = {
  sourceRow: number;
  reason: string;
};

// What the user decided for a row: the category to file it under, or to leave it out
export type ImportChoice = {
  categoryId: string | null;
  skipped: boolean;
};

// Both limits are checked again on the server for what actually arrives there
export const MAX_IMPORT_ROWS = 500;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Same limit as a transaction's description
export const MAX_DESCRIPTION_LENGTH = 120;
