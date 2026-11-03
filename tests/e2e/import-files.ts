import writeExcelFile from "write-excel-file/node";

export type UploadFile = { name: string; mimeType: string; buffer: Buffer };

export const csvFile = (text: string, name = "statement.csv"): UploadFile => ({
  name,
  mimeType: "text/csv",
  buffer: Buffer.from(text, "utf8"),
});

// What Hebrew banks and older Excel versions save as "CSV": windows-1255, not UTF-8.
// Hebrew letters are 0xE0-0xFA there, and the shekel sign is 0xA4.
export const cp1255CsvFile = (text: string, name = "bank.csv"): UploadFile => ({
  name,
  mimeType: "text/csv",
  buffer: Buffer.from(
    [...text].map((char) => {
      const code = char.charCodeAt(0);
      if (code < 0x80) return code;
      if (code >= 0x05d0 && code <= 0x05ea) return code - 0x05d0 + 0xe0;
      if (char === "₪") return 0xa4;
      return 0x3f;
    }),
  ),
});

type SheetValue = string | number | Date | null;

// A real .xlsx file. Dates are written as date cells, the way Excel stores them.
export const xlsxFile = async (rows: SheetValue[][], name = "statement.xlsx"): Promise<UploadFile> => {
  const sheet = rows.map((row) =>
    row.map((value) =>
      value instanceof Date ? { value, type: Date, format: "dd/mm/yyyy" } : value,
    ),
  );
  const buffer = await writeExcelFile(sheet as never).toBuffer();

  return {
    name,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(buffer),
  };
};
