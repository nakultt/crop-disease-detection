import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("leaves plain values alone", () => {
    expect(csvCell("Tomato")).toBe("Tomato");
    expect(csvCell(0.93)).toBe("0.93");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises spreadsheet formulas in text", () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(
      '"\'=HYPERLINK(""http://evil"")"',
    );
    expect(csvCell("+1+1")).toBe("'+1+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-cmd")).toBe("'-cmd");
  });

  it("does not mangle negative numbers", () => {
    expect(csvCell(-3)).toBe("-3");
  });

  it("renders empty for null, undefined and non-finite numbers", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(Number.NaN)).toBe("");
  });

  it("formats dates as ISO 8601", () => {
    expect(csvCell(new Date("2026-01-02T03:04:05.000Z"))).toBe(
      "2026-01-02T03:04:05.000Z",
    );
  });
});

describe("toCsv", () => {
  it("joins rows with CRLF", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          [1, 2],
          ["x", "y"],
        ],
      ),
    ).toBe("a,b\r\n1,2\r\nx,y");
  });
});
