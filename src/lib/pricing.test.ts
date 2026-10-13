import { describe, expect, it } from "vitest";
import { ghsToGbpMinor, gbpToGhsMinor } from "./pricing";

describe("gbpToGhsMinor", () => {
  it("applies rate and markup, rounding half up once", () => {
    expect(gbpToGhsMinor(10000, { rate: 15, markupPct: 0 })).toBe(150000);
    expect(gbpToGhsMinor(10000, { rate: 15, markupPct: 10 })).toBe(165000);
    // 1 pence * 15.5 = 15.5 pesewas -> 16
    expect(gbpToGhsMinor(1, { rate: 15.5, markupPct: 0 })).toBe(16);
  });
  it("returns 0 for zero or negative amounts", () => {
    expect(gbpToGhsMinor(0, { rate: 15, markupPct: 0 })).toBe(0);
    expect(gbpToGhsMinor(-5, { rate: 15, markupPct: 0 })).toBe(0);
  });
  it("stays exact for large amounts", () => {
    expect(gbpToGhsMinor(10_000_000, { rate: 20.1234, markupPct: 3.25 })).toBe(
      Math.round((10_000_000 * 201234 * 10325) / 1e8),
    );
  });
});

describe("ghsToGbpMinor", () => {
  it("reverses the conversion at the same rate", () => {
    expect(ghsToGbpMinor(100000, { rate: 10, markupPct: 0 })).toBe(10000);
    expect(ghsToGbpMinor(165000, { rate: 15, markupPct: 10 })).toBe(10000);
    expect(ghsToGbpMinor(0, { rate: 15, markupPct: 0 })).toBe(0);
  });
  it("is within a penny of the original after a round trip", () => {
    const fx = { rate: 15.2, markupPct: 3 };
    for (const pence of [1, 99, 6499, 129_98, 1_000_000]) {
      const back = ghsToGbpMinor(gbpToGhsMinor(pence, fx), fx);
      expect(Math.abs(back - pence)).toBeLessThanOrEqual(1);
    }
  });
});
