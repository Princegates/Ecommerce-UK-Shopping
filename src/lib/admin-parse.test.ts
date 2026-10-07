import { describe, expect, it } from "vitest";
import {
  bracketsToText, isHexColour, optionGroupsToText, parseBrackets, parseOptionGroups, parseTiers, safeUrl, tiersToText,
} from "./admin-parse";

describe("parseBrackets", () => {
  it("parses, sorts and round-trips", () => {
    const r = parseBrackets("1000, 90\n500, 60.50");
    expect(r).toEqual({ ok: true, value: [{ upToGrams: 500, priceMinor: 6050 }, { upToGrams: 1000, priceMinor: 9000 }] });
    if (r.ok) expect(parseBrackets(bracketsToText(r.value))).toEqual(r);
  });
  it("rejects bad lines and duplicates", () => {
    expect(parseBrackets("abc").ok).toBe(false);
    expect(parseBrackets("500, 60\n500, 70").ok).toBe(false);
    expect(parseBrackets("").ok).toBe(false);
    expect(parseBrackets("-5, 10").ok).toBe(false);
  });
});

describe("parseTiers", () => {
  it("parses bands and requires an open last band", () => {
    const r = parseTiers("50, 15\n150, 12\n*, 8");
    expect(r.ok && r.value.map((t) => t.percent)).toEqual([15, 12, 8]);
    if (r.ok) expect(parseTiers(tiersToText(r.value))).toEqual(r);
    expect(parseTiers("50, 15").ok).toBe(false);
    expect(parseTiers("*, 8\n50, 15").ok).toBe(false);
    expect(parseTiers("100, 10\n50, 12\n*, 8").ok).toBe(false);
    expect(parseTiers("50, 150\n*, 8").ok).toBe(false);
  });
});

describe("parseOptionGroups", () => {
  it("parses groups", () => {
    const r = parseOptionGroups("Size: S, M, L\nColour: Black, White");
    expect(r.ok && r.value).toEqual([{ name: "Size", values: ["S", "M", "L"] }, { name: "Colour", values: ["Black", "White"] }]);
    if (r.ok) expect(parseOptionGroups(optionGroupsToText(r.value))).toEqual(r);
  });
  it("accepts an empty list and rejects malformed or duplicate input", () => {
    expect(parseOptionGroups("")).toEqual({ ok: true, value: [] });
    expect(parseOptionGroups("Size").ok).toBe(false);
    expect(parseOptionGroups("Size: S, S").ok).toBe(false);
    expect(parseOptionGroups("Size: S\nsize: M").ok).toBe(false);
  });
});

describe("safeUrl and colour", () => {
  it("allows only http(s)", () => {
    expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("")).toBe("");
    expect(safeUrl("not a url")).toBeNull();
  });
  it("checks hex colours", () => {
    expect(isHexColour("#0b5d3b")).toBe(true);
    expect(isHexColour("red")).toBe(false);
  });
});
