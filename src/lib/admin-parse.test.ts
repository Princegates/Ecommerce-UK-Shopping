import { describe, expect, it } from "vitest";
import { isHexColour, optionGroupsToText, parseOptionGroups, safeUrl } from "./admin-parse";

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
