import { describe, expect, it } from "vitest";
import { csvCell } from "./csv";

describe("csvCell", () => {
  it("quotes and escapes", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell(12.5)).toBe('"12.5"');
  });
  it("defuses spreadsheet formulas", () => {
    for (const evil of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)"]) expect(csvCell(evil).startsWith(`"'`)).toBe(true);
    expect(csvCell("Ama")).toBe('"Ama"');
  });
});
