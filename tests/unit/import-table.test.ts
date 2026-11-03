import { describe, expect, it } from "vitest";
import {
  buildRows,
  cleanTable,
  columnCount,
  columnLabels,
  detectMapping,
  findHeaderRow,
  isMappingComplete,
} from "@/lib/import/table";
import type { Table } from "@/lib/import/types";

describe("cleanTable", () => {
  it("trims text and turns blank cells into null, keeping numbers, dates and the row count", () => {
    const date = new Date("2026-10-31T00:00:00Z");

    expect(cleanTable([[" Shop ", "", "   ", 12.5, date, undefined, true], []])).toEqual([
      ["Shop", null, null, 12.5, date, null, true],
      [],
    ]);
  });
});

describe("columnCount", () => {
  it("is the width of the widest row", () => {
    expect(columnCount([["a"], ["a", "b", "c"], ["a", "b"]])).toBe(3);
    expect(columnCount([])).toBe(0);
  });
});

describe("findHeaderRow", () => {
  it("finds a header on the first row", () => {
    expect(findHeaderRow([["Date", "Description", "Amount"], ["31/10/2026", "Shop", "12.50"]])).toBe(0);
  });

  it("skips lines about the account before the header", () => {
    const table: Table = [
      ["Account 123-456"],
      ["Statement for October 2026", null, null],
      [],
      ["Date", "Details", "Amount"],
      ["31/10/2026", "Shop", "12.50"],
    ];

    expect(findHeaderRow(table)).toBe(3);
  });

  it.each([
    [["Transaction Date", "Merchant", "Debit", "Credit", "Balance"]],
    [["DATE", "DESCRIPTION", "AMOUNT"]],
    [["תאריך עסקה", "שם בית עסק", "סכום חיוב"]],
    [["תאריך", "תיאור", "חובה", "זכות", "יתרה"]],
    [["Date", "Memo", "Sum"]],
  ])("recognises the header %j", (header) => {
    expect(findHeaderRow([header, ["x", "y", "z"]])).toBe(0);
  });

  it("needs at least two kinds of column to be named", () => {
    expect(findHeaderRow([["Date", "Reference"], ["31/10/2026", "A1"]])).toBeNull();
  });

  it("returns null when no row looks like a header", () => {
    expect(findHeaderRow([["31/10/2026", "Shop", "12.50"], ["01/11/2026", "Cafe", "3.20"]])).toBeNull();
    expect(findHeaderRow([])).toBeNull();
  });

  it("only looks at the first 30 rows", () => {
    const filler: Table = Array.from({ length: 30 }, () => ["x", "y"]);

    expect(findHeaderRow([...filler, ["Date", "Amount"]])).toBeNull();
    expect(findHeaderRow([...filler.slice(1), ["Date", "Amount"]])).toBe(29);
  });
});

describe("columnLabels", () => {
  it("uses the header text, and 'Column X' for a column without one", () => {
    expect(columnLabels([["Date", null, "Amount"], ["a", "b", "c"]], 0)).toEqual(["Date", "Column B", "Amount"]);
  });

  it("covers columns that only data rows have", () => {
    expect(columnLabels([["Date"], ["a", "b", "c"]], 0)).toEqual(["Date", "Column B", "Column C"]);
  });

  it("tells columns with the same header apart", () => {
    expect(columnLabels([["Amount", "Amount"], ["1", "2"]], 0)).toEqual(["Amount", "Amount (B)"]);
  });

  it("names columns past Z", () => {
    const header = Array.from({ length: 28 }, () => null);

    const labels = columnLabels([header], 0);

    expect(labels[0]).toBe("Column A");
    expect(labels[25]).toBe("Column Z");
    expect(labels[26]).toBe("Column AA");
    expect(labels[27]).toBe("Column AB");
  });
});

describe("detectMapping", () => {
  it("maps columns from their headers", () => {
    expect(detectMapping([["Amount", "Date", "Description"], ["12.50", "31/10/2026", "Shop"]], 0)).toEqual({
      date: 1,
      description: 2,
      amount: 0,
    });
  });

  it("maps a Hebrew header", () => {
    const table: Table = [
      ["תאריך עסקה", "שם בית עסק", "סכום חיוב", "הערות"],
      ["31/10/2026", "סופר", "12.50", null],
    ];

    expect(detectMapping(table, 0)).toEqual({ date: 0, description: 1, amount: 2 });
  });

  it("takes the debit column of a file with debit and credit", () => {
    const table: Table = [
      ["Date", "Description", "Debit", "Credit", "Balance"],
      ["31/10/2026", "Shop", "12.50", null, "900"],
    ];

    expect(detectMapping(table, 0)).toEqual({ date: 0, description: 1, amount: 2 });
  });

  it("doesn't take a second date column as the amount, even if its header says 'charge'", () => {
    const table: Table = [
      ["תאריך עסקה", "תאריך חיוב", "שם בית עסק", "סכום חיוב"],
      ["30/10/2026", "10/11/2026", "סופר", "12.50"],
    ];

    expect(detectMapping(table, 0)).toEqual({ date: 0, description: 2, amount: 3 });
  });

  it("uses the first column of a kind when there are several", () => {
    const table: Table = [
      ["Date", "Value date", "Description", "Amount"],
      ["30/10/2026", "31/10/2026", "Shop", "12.50"],
    ];

    expect(detectMapping(table, 0).date).toBe(0);
  });

  it("guesses columns from their contents when the headers don't say", () => {
    const table: Table = [
      ["A", "B", "C"],
      ["31/10/2026", "Supermarket downtown", "12.50"],
      ["01/11/2026", "Cafe", "3.20"],
      ["02/11/2026", "Pharmacy on the corner", "45"],
    ];

    expect(detectMapping(table, 0)).toEqual({ date: 0, description: 1, amount: 2 });
  });

  it("combines headers for some columns and contents for the rest", () => {
    const table: Table = [
      ["Date", "Name of the thing", "Total"],
      ["31/10/2026", "Supermarket downtown", "12.50"],
      ["01/11/2026", "Cafe", "3.20"],
    ];

    expect(detectMapping(table, 0)).toEqual({ date: 0, description: 1, amount: 2 });
  });

  it("works with real dates and numbers from a spreadsheet", () => {
    const table: Table = [
      ["A", "B", "C"],
      [new Date("2026-10-31T00:00:00Z"), "Supermarket", -12.5],
      [new Date("2026-11-01T00:00:00Z"), "Cafe", -3.2],
    ];

    expect(detectMapping(table, 0)).toEqual({ date: 0, description: 1, amount: 2 });
  });

  it("leaves a column unmapped when nothing fits", () => {
    const table: Table = [
      ["Date", "Amount"],
      ["31/10/2026", "12.50"],
    ];

    expect(detectMapping(table, 0)).toEqual({ date: 0, description: null, amount: 1 });
  });

  it("maps nothing for an empty table", () => {
    expect(detectMapping([[]], 0)).toEqual({ date: null, description: null, amount: null });
    expect(detectMapping([], 0)).toEqual({ date: null, description: null, amount: null });
  });
});

describe("isMappingComplete", () => {
  it("needs all three columns", () => {
    expect(isMappingComplete({ date: 0, description: 1, amount: 2 })).toBe(true);
    expect(isMappingComplete({ date: 0, description: 0, amount: 0 })).toBe(true);
    expect(isMappingComplete({ date: null, description: 1, amount: 2 })).toBe(false);
    expect(isMappingComplete({ date: 0, description: null, amount: 2 })).toBe(false);
    expect(isMappingComplete({ date: 0, description: 1, amount: null })).toBe(false);
  });
});

describe("buildRows", () => {
  const mapping = { date: 0, description: 1, amount: 2 };

  it("turns the rows below the header into expenses, numbered as in the file", () => {
    const table: Table = [
      ["Date", "Description", "Amount"],
      ["31/10/2026", "Shop", "12.50"],
      ["01/11/2026", "Cafe", "3.2"],
    ];

    expect(buildRows(table, 0, mapping)).toEqual({
      rows: [
        { sourceRow: 2, date: "2026-10-31", description: "Shop", amount: 12.5 },
        { sourceRow: 3, date: "2026-11-01", description: "Cafe", amount: 3.2 },
      ],
      skipped: [],
    });
  });

  it("starts below the header row, wherever it is", () => {
    const table: Table = [
      ["Account 123"],
      ["Date", "Description", "Amount"],
      ["31/10/2026", "Shop", "12.50"],
    ];

    expect(buildRows(table, 1, mapping).rows).toEqual([
      { sourceRow: 3, date: "2026-10-31", description: "Shop", amount: 12.5 },
    ]);
  });

  it("makes every amount positive: a negative amount is an expense", () => {
    const table: Table = [
      ["Date", "Description", "Amount"],
      ["31/10/2026", "Shop", "-12.50"],
      ["01/11/2026", "Cafe", -3.2],
      ["02/11/2026", "Fuel", "(45.00)"],
    ];

    expect(buildRows(table, 0, mapping).rows.map((r) => r.amount)).toEqual([12.5, 3.2, 45]);
  });

  it("reads real dates and numbers from a spreadsheet", () => {
    const table: Table = [
      ["Date", "Description", "Amount"],
      [new Date("2026-10-31T00:00:00Z"), "Shop", -12.5],
    ];

    expect(buildRows(table, 0, mapping).rows).toEqual([
      { sourceRow: 2, date: "2026-10-31", description: "Shop", amount: 12.5 },
    ]);
  });

  it("uses the columns it is told to, in any order", () => {
    const table: Table = [
      ["Amount", "Date", "Description"],
      ["12.50", "31/10/2026", "Shop"],
    ];

    expect(buildRows(table, 0, { date: 1, description: 2, amount: 0 }).rows).toEqual([
      { sourceRow: 2, date: "2026-10-31", description: "Shop", amount: 12.5 },
    ]);
  });

  describe("rows it can't use are skipped, with the reason", () => {
    it.each([
      ["a date that isn't one", ["31/02/2026", "Shop", "12.50"], "Couldn't read the date"],
      ["a missing date", [null, "Shop", "12.50"], "Couldn't read the date"],
      ["a total line", ["Total", null, "512.50"], "Couldn't read the date"],
      ["a missing amount", ["31/10/2026", "Shop", null], "No amount"],
      ["text where the amount should be", ["31/10/2026", "Shop", "n/a"], "Couldn't read the amount"],
      ["a zero amount", ["31/10/2026", "Shop", "0.00"], "The amount is zero"],
      ["a huge amount", ["31/10/2026", "Shop", "99999999999"], "The amount is too large"],
    ])("%s", (_name, row, reason) => {
      const table: Table = [["Date", "Description", "Amount"], row, ["01/11/2026", "Good", "5"]];

      const { rows, skipped } = buildRows(table, 0, mapping);

      expect(skipped).toEqual([{ sourceRow: 2, reason }]);
      expect(rows.map((r) => r.description)).toEqual(["Good"]);
    });

    it("reports only the first problem of a row", () => {
      const table: Table = [["Date", "Description", "Amount"], ["nope", "Shop", "nope"]];

      expect(buildRows(table, 0, mapping).skipped).toEqual([{ sourceRow: 2, reason: "Couldn't read the date" }]);
    });

    it("keeps the exact largest amount a transaction can hold", () => {
      const table: Table = [["Date", "Description", "Amount"], ["31/10/2026", "Big", "9999999999.99"]];

      expect(buildRows(table, 0, mapping).rows[0].amount).toBe(9999999999.99);
    });
  });

  it("doesn't count rows with nothing in them", () => {
    const table: Table = [
      ["Date", "Description", "Amount"],
      [],
      [null, null, null],
      ["31/10/2026", "Shop", "12.50"],
      [],
    ];

    const { rows, skipped } = buildRows(table, 0, mapping);

    expect(rows).toHaveLength(1);
    expect(rows[0].sourceRow).toBe(4);
    expect(skipped).toEqual([]);
  });

  describe("descriptions", () => {
    const rowWith = (description: Table[number][number]) =>
      buildRows([["Date", "Description", "Amount"], ["31/10/2026", description, "5"]], 0, mapping).rows[0]
        .description;

    it("tidies up spacing", () => {
      expect(rowWith("  Super   market\n  downtown ")).toBe("Super market downtown");
    });

    it("falls back to '(no description)' for an empty one", () => {
      expect(rowWith(null)).toBe("(no description)");
      expect(rowWith("   ")).toBe("(no description)");
    });

    it("accepts a number as a description", () => {
      expect(rowWith(12345)).toBe("12345");
    });

    it("cuts one that is too long to what a transaction can hold", () => {
      const long = "a".repeat(150);

      expect(rowWith(long)).toBe("a".repeat(120));
      expect(rowWith(`${"a".repeat(119)} ${"b".repeat(30)}`)).toBe("a".repeat(119));
    });

    it("keeps Hebrew text", () => {
      expect(rowWith("סופר בע\"מ")).toBe("סופר בע\"מ");
    });
  });

  it("returns nothing while the mapping is incomplete", () => {
    const table: Table = [["Date", "Description", "Amount"], ["31/10/2026", "Shop", "12.50"]];

    expect(buildRows(table, 0, { date: 0, description: null, amount: 2 })).toEqual({ rows: [], skipped: [] });
  });

  it("handles a column that doesn't exist in a short row", () => {
    const table: Table = [["Date", "Description", "Amount"], ["31/10/2026", "Shop"]];

    expect(buildRows(table, 0, mapping)).toEqual({
      rows: [],
      skipped: [{ sourceRow: 2, reason: "No amount" }],
    });
  });

  it("works on a realistic Hebrew bank export, with lines before the header and a total at the end", () => {
    const table = cleanTable([
      ["פירוט עסקאות לחשבון 123-456"],
      ["", "", ""],
      ["תאריך עסקה", "תאריך חיוב", "שם בית עסק", "סכום עסקה", "סכום חיוב"],
      ["30/10/2026", "10/11/2026", "שופרסל דיל", "₪ 245.30", "₪ 245.30"],
      ["31/10/2026", "10/11/2026", "קפה גרג", "18", "18"],
      ["01/11/2026", "10/11/2026", "החזר", "-50.00", "-50.00"],
      ["", "", "סה\"כ", "", "213.30"],
    ]);

    const headerRow = findHeaderRow(table)!;
    const mapping = detectMapping(table, headerRow);
    const { rows, skipped } = buildRows(table, headerRow, mapping);

    expect(headerRow).toBe(2);
    expect(mapping).toEqual({ date: 0, description: 2, amount: 3 });
    expect(rows).toEqual([
      { sourceRow: 4, date: "2026-10-30", description: "שופרסל דיל", amount: 245.3 },
      { sourceRow: 5, date: "2026-10-31", description: "קפה גרג", amount: 18 },
      { sourceRow: 6, date: "2026-11-01", description: "החזר", amount: 50 },
    ]);
    expect(skipped).toEqual([{ sourceRow: 7, reason: "Couldn't read the date" }]);
  });
});
