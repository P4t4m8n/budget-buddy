import { MAX_FILE_BYTES, type Table } from "./types";
import { cleanTable } from "./table";
import { decodeText, parseCsv } from "./csv";

// A problem with the chosen file that the user can understand and act on
export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}

const extensionOf = (name: string) => name.slice(name.lastIndexOf(".")).toLowerCase();

// Reads the first sheet of an .xlsx file, or a .csv file, in the browser. The file never
// leaves the browser: only the rows the user confirms are sent to the server.
export const readTableFromFile = async (file: File): Promise<Table> => {
  const extension = extensionOf(file.name);

  if (extension !== ".xlsx" && extension !== ".csv") {
    throw new ImportFileError("Choose an .xlsx or .csv file.");
  }
  if (file.size === 0) throw new ImportFileError("That file is empty.");
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportFileError(
      `That file is too large. Use one under ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
    );
  }

  let table: Table;
  try {
    if (extension === ".csv") {
      table = parseCsv(decodeText(await file.arrayBuffer()));
    } else {
      // Only loaded when someone actually imports a spreadsheet
      const { readSheet } = await import("read-excel-file/browser");
      table = (await readSheet(file)) as Table;
    }
  } catch {
    throw new ImportFileError(
      extension === ".csv"
        ? "That file couldn't be read."
        : "That file couldn't be read. Is it a valid .xlsx file?",
    );
  }

  const cleaned = cleanTable(table);
  if (cleaned.every((row) => row.every((cell) => cell === null))) {
    throw new ImportFileError("That file has no data in it.");
  }
  return cleaned;
};
