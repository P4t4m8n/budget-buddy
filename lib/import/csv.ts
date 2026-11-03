import type { Table } from "./types";

// Bank exports opened in Excel are often saved as UTF-8, but Hebrew banks and older Excel
// versions use windows-1255. UTF-8 is strict about what it accepts, so if the bytes aren't
// valid UTF-8 they are read as windows-1255 instead of showing gibberish.
export const decodeText = (buffer: ArrayBuffer): string => {
  try {
    // A leading byte order mark is dropped by the decoder
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1255").decode(buffer);
  }
};

const DELIMITERS = [",", ";", "\t"] as const;

// Splits text into rows of fields. A field in quotes can hold the delimiter, line breaks and
// "" for a quote. Empty fields are null, and rows with nothing in them at the end are dropped.
const parseDelimited = (text: string, delimiter: string): Table => {
  const rows: (string | null)[][] = [];
  let row: (string | null)[] = [];
  let field = "";
  let quoted = false;
  // Whether the field started with a quote, so "" (an empty quoted field) isn't a quote mark
  let fieldWasQuoted = false;

  const endField = () => {
    row.push(field === "" && !fieldWasQuoted ? null : field);
    field = "";
    fieldWasQuoted = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
      fieldWasQuoted = true;
    } else if (char === delimiter) {
      endField();
    } else if (char === "\n" || char === "\r") {
      // \r\n is one line break
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      field += char;
    }
  }
  // The last line has no line break after it
  if (field !== "" || fieldWasQuoted || row.length > 0) endRow();

  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell === null)) {
    rows.pop();
  }
  return rows;
};

// Excel saves "CSV" with commas, semicolons or tabs depending on the computer's region, so
// the delimiter is the one that splits the first lines into the most fields. (Counting rows
// with two or more fields isn't enough: the decimal comma in 12,50 would tie a semicolon file.)
const detectDelimiter = (text: string) => {
  const sample = text.slice(0, 20_000);
  let best: string = DELIMITERS[0];
  let bestScore = -1;

  for (const delimiter of DELIMITERS) {
    const score = parseDelimited(sample, delimiter)
      .slice(0, 20)
      .reduce((total, row) => total + Math.max(row.length - 1, 0), 0);
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
};

export const parseCsv = (text: string): Table =>
  parseDelimited(text, detectDelimiter(text));
