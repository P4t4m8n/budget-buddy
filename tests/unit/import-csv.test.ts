import { describe, expect, it } from "vitest";
import { decodeText, parseCsv } from "@/lib/import/csv";

const bytes = (...values: number[]) => new Uint8Array(values).buffer;
const utf8 = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe("decodeText", () => {
  it("reads UTF-8, Hebrew included", () => {
    expect(decodeText(utf8("תאריך,סכום"))).toBe("תאריך,סכום");
  });

  it("drops a UTF-8 byte order mark", () => {
    expect(decodeText(bytes(0xef, 0xbb, 0xbf, 0x44, 0x61, 0x74, 0x65))).toBe("Date");
  });

  it("falls back to windows-1255 when the bytes aren't UTF-8", () => {
    // "תאריך" as windows-1255, which is not valid UTF-8
    expect(decodeText(bytes(0xfa, 0xe0, 0xf8, 0xe9, 0xea))).toBe("תאריך");
  });

  it("reads windows-1255 mixed with plain ASCII", () => {
    expect(decodeText(bytes(0x31, 0x2c, 0xfa, 0xe0, 0x2c, 0x32))).toBe("1,תא,2");
  });

  it("reads an empty file as empty text", () => {
    expect(decodeText(bytes())).toBe("");
  });
});

describe("parseCsv", () => {
  it("splits comma separated rows into fields", () => {
    expect(parseCsv("Date,Description,Amount\n31/10/2026,Shop,12.50")).toEqual([
      ["Date", "Description", "Amount"],
      ["31/10/2026", "Shop", "12.50"],
    ]);
  });

  it("detects semicolons, even when the amounts have decimal commas", () => {
    expect(parseCsv("Date;Description;Amount\n31/10/2026;Shop;12,50\n01/11/2026;Cafe;3,20")).toEqual([
      ["Date", "Description", "Amount"],
      ["31/10/2026", "Shop", "12,50"],
      ["01/11/2026", "Cafe", "3,20"],
    ]);
  });

  it("detects tabs", () => {
    expect(parseCsv("Date\tDescription\tAmount\n31/10/2026\tShop\t12.50")).toEqual([
      ["Date", "Description", "Amount"],
      ["31/10/2026", "Shop", "12.50"],
    ]);
  });

  it("keeps a quoted field's delimiter, line break and quotes", () => {
    expect(parseCsv('a,b\n"Shop, branch 2","He said ""hi""\nbye"')).toEqual([
      ["a", "b"],
      ["Shop, branch 2", 'He said "hi"\nbye'],
    ]);
  });

  it("doesn't split on a comma inside quotes when semicolons are the delimiter", () => {
    expect(parseCsv('Date;Description;Amount\n31/10/2026;"Shop, branch 2";12,50')).toEqual([
      ["Date", "Description", "Amount"],
      ["31/10/2026", "Shop, branch 2", "12,50"],
    ]);
  });

  it.each([
    ["CRLF", "a,b\r\n1,2\r\n3,4"],
    ["LF", "a,b\n1,2\n3,4"],
    ["CR", "a,b\r1,2\r3,4"],
  ])("handles %s line breaks", (_name, text) => {
    expect(parseCsv(text)).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("reads the last line without a line break, and ignores blank lines at the end", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a,b\n1,2\n\n\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a,b\n1,2\n,,\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("keeps a blank line in the middle, so row numbers match the file", () => {
    expect(parseCsv("a,b\n\n1,2")).toEqual([["a", "b"], [null], ["1", "2"]]);
  });

  it("turns empty fields into null, and an empty quoted field into an empty string", () => {
    expect(parseCsv('a,b,c\n1,,3\n"",2,')).toEqual([
      ["a", "b", "c"],
      ["1", null, "3"],
      ["", "2", null],
    ]);
  });

  it("copes with lines before the header that have no delimiter", () => {
    expect(parseCsv("Account 123\nStatement for October\nDate,Amount\n31/10/2026,12.50")).toEqual([
      ["Account 123"],
      ["Statement for October"],
      ["Date", "Amount"],
      ["31/10/2026", "12.50"],
    ]);
  });

  it("keeps Hebrew text", () => {
    expect(parseCsv("תאריך,תיאור,סכום\n31/10/2026,סופר,12.50")).toEqual([
      ["תאריך", "תיאור", "סכום"],
      ["31/10/2026", "סופר", "12.50"],
    ]);
  });

  it("reads an empty file as no rows", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("\n\n")).toEqual([]);
  });

  it("reads a single column", () => {
    expect(parseCsv("a\nb")).toEqual([["a"], ["b"]]);
  });

  it("doesn't treat a quote in the middle of a field as the start of a quoted one", () => {
    expect(parseCsv('a,b\n5" pipe,2')).toEqual([["a", "b"], ['5" pipe', "2"]]);
  });
});
