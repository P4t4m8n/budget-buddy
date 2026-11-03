import { parseAmountCell, parseDateCell, MAX_AMOUNT } from "./values";
import {
  MAX_DESCRIPTION_LENGTH,
  type Cell,
  type ColumnMapping,
  type ImportRow,
  type SkippedRow,
  type Table,
} from "./types";

// Words that name each kind of column in bank exports, in English and Hebrew. A header
// matches when it contains one of them. Credit columns are left out on purpose: every row
// is imported as an expense, so a file with separate debit and credit columns uses the debit one.
const HEADER_WORDS = {
  date: [
    "date",
    "תאריך",
    "יום עסקה",
  ],
  description: [
    "description",
    "details",
    "merchant",
    "payee",
    "memo",
    "narrative",
    "תיאור",
    "תאור",
    "פרטים",
    "בית עסק",
    "שם העסק",
    "פירוט",
  ],
  amount: [
    "amount",
    "debit",
    "charge",
    "sum",
    "סכום",
    "חיוב",
    "חובה",
  ],
} as const;

type Field = keyof typeof HEADER_WORDS;
const FIELDS = Object.keys(HEADER_WORDS) as Field[];

// How many rows from the top are looked at to find the header, and the sample used to guess
// columns from their contents
const HEADER_SEARCH_ROWS = 30;
const SAMPLE_ROWS = 25;

const text = (cell: Cell) => (typeof cell === "string" ? cell : "");

// Text cells are trimmed and blank ones become null, so "nothing here" looks the same
// whether the file was a CSV or a spreadsheet
export const cleanTable = (table: Table): Table =>
  table.map((row) =>
    row.map((cell) => {
      if (typeof cell === "string") return cell.trim() === "" ? null : cell.trim();
      return cell === undefined ? null : cell;
    }),
  );

const isEmptyRow = (row: Cell[]) => row.every((cell) => cell === null || cell === undefined);

export const columnCount = (table: Table) =>
  table.reduce((widest, row) => Math.max(widest, row.length), 0);

const matches = (header: Cell, field: Field) => {
  const value = text(header).toLowerCase();
  return value !== "" && HEADER_WORDS[field].some((word) => value.includes(word));
};

// The row that names the columns: the first one in which at least two kinds of column
// are named (Date and Amount, say). Exports often start with lines about the account, so
// it isn't always the first row. Null when no row looks like a header.
export const findHeaderRow = (table: Table): number | null => {
  const limit = Math.min(table.length, HEADER_SEARCH_ROWS);

  for (let index = 0; index < limit; index++) {
    const named = FIELDS.filter((field) => table[index].some((cell) => matches(cell, field)));
    if (named.length >= 2) return index;
  }
  return null;
};

const columnLetter = (index: number) => {
  let letter = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
  }
  return letter;
};

// What to call each column when choosing one: its header, or "Column B" when it has none
export const columnLabels = (table: Table, headerRow: number): string[] => {
  const header = table[headerRow] ?? [];
  const labels = Array.from({ length: columnCount(table) }, (_, index) => {
    const name = text(header[index]);
    return name !== "" ? name : `Column ${columnLetter(index)}`;
  });
  // Two columns with the same header would be impossible to tell apart
  return labels.map((label, index) =>
    labels.indexOf(label) === index ? label : `${label} (${columnLetter(index)})`,
  );
};

const sampleColumn = (table: Table, headerRow: number, column: number) =>
  table
    .slice(headerRow + 1, headerRow + 1 + SAMPLE_ROWS)
    .filter((row) => !isEmptyRow(row))
    .map((row) => row[column] ?? null);

const share = (values: Cell[], accepts: (value: Cell) => boolean) => {
  const present = values.filter((value) => value !== null && value !== undefined);
  return present.length === 0
    ? 0
    : present.filter(accepts).length / present.length;
};

// A first guess at which column is which: from the headers, and for anything they don't
// settle, from what the columns contain. The user can change it.
export const detectMapping = (table: Table, headerRow: number): ColumnMapping => {
  const width = columnCount(table);
  const header = table[headerRow] ?? [];
  const mapping: ColumnMapping = { date: null, description: null, amount: null };
  const taken = new Set<number>();

  for (const field of FIELDS) {
    const column = Array.from({ length: width }, (_, i) => i).find(
      (i) =>
        !taken.has(i) &&
        matches(header[i], field) &&
        // "תאריך חיוב" (charge date) is a date, not the charge
        (field === "date" || !matches(header[i], "date")),
    );
    if (column !== undefined) {
      mapping[field] = column;
      taken.add(column);
    }
  }

  const free = () => Array.from({ length: width }, (_, i) => i).filter((i) => !taken.has(i));
  const best = (score: (column: number) => number, atLeast: number) => {
    let winner: number | null = null;
    let winnerScore = atLeast;
    for (const column of free()) {
      const value = score(column);
      if (value >= winnerScore && (winner === null || value > winnerScore)) {
        winner = column;
        winnerScore = value;
      }
    }
    return winner;
  };

  if (mapping.date === null) {
    const column = best(
      (c) => share(sampleColumn(table, headerRow, c), (v) => parseDateCell(v) !== null),
      0.6,
    );
    if (column !== null) {
      mapping.date = column;
      taken.add(column);
    }
  }
  if (mapping.amount === null) {
    const column = best(
      (c) => share(sampleColumn(table, headerRow, c), (v) => parseAmountCell(v) !== null),
      0.6,
    );
    if (column !== null) {
      mapping.amount = column;
      taken.add(column);
    }
  }
  if (mapping.description === null) {
    // The column with the longest text, as long as it isn't mostly dates or amounts
    const column = best((c) => {
      const values = sampleColumn(table, headerRow, c).filter(
        (v): v is string => typeof v === "string",
      );
      if (values.length === 0) return 0;
      const wordy = share(values, (v) => parseAmountCell(v) === null && parseDateCell(v) === null);
      if (wordy < 0.6) return 0;
      return values.reduce((total, v) => total + v.length, 0) / values.length;
    }, 1);
    if (column !== null) mapping.description = column;
  }

  return mapping;
};

export const isMappingComplete = (mapping: ColumnMapping) =>
  mapping.date !== null && mapping.description !== null && mapping.amount !== null;

const cleanDescription = (cell: Cell) => {
  const raw =
    typeof cell === "string" ? cell : typeof cell === "number" ? String(cell) : "";
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed === "") return "(no description)";
  return collapsed.length > MAX_DESCRIPTION_LENGTH
    ? collapsed.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd()
    : collapsed;
};

// The rows below the header, read with the chosen columns. A row that can't be read (a
// total at the bottom, a blank amount, a date that isn't one) is skipped with the reason,
// so nothing disappears without a word. Rows with nothing in them aren't counted.
export const buildRows = (
  table: Table,
  headerRow: number,
  mapping: ColumnMapping,
): { rows: ImportRow[]; skipped: SkippedRow[] } => {
  const rows: ImportRow[] = [];
  const skipped: SkippedRow[] = [];

  if (!isMappingComplete(mapping)) return { rows, skipped };
  const { date: dateColumn, description: descriptionColumn, amount: amountColumn } =
    mapping as { date: number; description: number; amount: number };

  for (let index = headerRow + 1; index < table.length; index++) {
    const row = table[index];
    if (isEmptyRow(row)) continue;

    const sourceRow = index + 1;
    const date = parseDateCell(row[dateColumn]);
    const amountCell = row[amountColumn];
    const amount = parseAmountCell(amountCell);

    const reason =
      date === null
        ? "Couldn't read the date"
        : amountCell === null || amountCell === undefined
          ? "No amount"
          : amount === null
            ? "Couldn't read the amount"
            : amount === 0
              ? "The amount is zero"
              : amount > MAX_AMOUNT
                ? "The amount is too large"
                : null;

    if (reason !== null) {
      skipped.push({ sourceRow, reason });
    } else {
      rows.push({
        sourceRow,
        date: date!,
        description: cleanDescription(row[descriptionColumn]),
        amount: amount!,
      });
    }
  }
  return { rows, skipped };
};
