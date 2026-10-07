import { describe, expect, it } from "vitest";
import {
  ghsToGbpMinor,
  chargeableGrams,
  gbpToGhsMinor,
  priceOrder,
  serviceFeeMinor,
  shippingMinor,
  type RateCard,
  type ServiceFeeRule,
} from "./pricing";

const card: RateCard = {
  brackets: [
    { upToGrams: 500, priceMinor: 6000 },
    { upToGrams: 1000, priceMinor: 9000 },
    { upToGrams: 2000, priceMinor: 15000 },
  ],
  extraPerKgMinor: 6000,
  minChargeMinor: 7000,
};

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

describe("serviceFeeMinor", () => {
  it("percent with minimum", () => {
    const rule: ServiceFeeRule = { mode: "percent", percent: 10, minMinor: 3000 };
    expect(serviceFeeMinor(rule, 100000, 6000)).toBe(10000);
    expect(serviceFeeMinor(rule, 10000, 600)).toBe(3000);
  });
  it("fixed", () => {
    expect(serviceFeeMinor({ mode: "fixed", fixedMinor: 5000 }, 99999, 5000)).toBe(5000);
  });
  it("tiered picks the band by GBP total", () => {
    const rule: ServiceFeeRule = {
      mode: "tiered",
      minMinor: 0,
      tiers: [
        { upToGbpMinor: 5000, percent: 15 },
        { upToGbpMinor: 15000, percent: 12 },
        { upToGbpMinor: null, percent: 8 },
      ],
    };
    expect(serviceFeeMinor(rule, 100000, 5000)).toBe(15000);
    expect(serviceFeeMinor(rule, 100000, 5001)).toBe(12000);
    expect(serviceFeeMinor(rule, 100000, 90000)).toBe(8000);
  });
  it("is zero for an empty basket", () => {
    expect(serviceFeeMinor({ mode: "fixed", fixedMinor: 5000 }, 0, 0)).toBe(0);
  });
});

describe("shipping", () => {
  it("uses the bracket, the minimum charge and the per-kg extra", () => {
    expect(shippingMinor(card, 300)).toBe(7000); // 6000 bracket raised to the minimum
    expect(shippingMinor(card, 800)).toBe(9000);
    expect(shippingMinor(card, 2000)).toBe(15000);
    expect(shippingMinor(card, 2001)).toBe(21000); // one started extra kg
    expect(shippingMinor(card, 4500)).toBe(15000 + 3 * 6000);
    expect(shippingMinor(card, 0)).toBe(0);
  });
  it("charges the greater of actual and volumetric weight", () => {
    expect(
      chargeableGrams([
        { id: "a", unitPriceMinor: 1, quantity: 2, weightGrams: 400, volumetricGrams: 900 },
        { id: "b", unitPriceMinor: 1, quantity: 1, weightGrams: 700 },
      ]),
    ).toBe(2 * 900 + 700);
  });
});

describe("priceOrder", () => {
  it("adds items + service charge + shipping + delivery", () => {
    const out = priceOrder({
      items: [
        { id: "x", unitPriceMinor: 8000, quantity: 1, weightGrams: 900 },
        { id: "y", unitPriceMinor: 2500, quantity: 2, weightGrams: 150 },
      ],
      fx: { rate: 15, markupPct: 0 },
      serviceFee: { mode: "percent", percent: 10, minMinor: 0 },
      rateCard: card,
      deliveryFeeMinor: 4000,
    });
    expect(out.itemsGbpMinor).toBe(13000);
    expect(out.itemsGhsMinor).toBe(195000);
    expect(out.serviceFeeMinor).toBe(19500);
    expect(out.chargeableGrams).toBe(1200);
    expect(out.shippingMinor).toBe(15000);
    expect(out.deliveryMinor).toBe(4000);
    expect(out.totalMinor).toBe(195000 + 19500 + 15000 + 4000);
  });
  it("prices an empty basket at zero", () => {
    const out = priceOrder({
      items: [],
      fx: { rate: 15, markupPct: 0 },
      serviceFee: { mode: "fixed", fixedMinor: 5000 },
      rateCard: card,
      deliveryFeeMinor: 4000,
    });
    expect(out.totalMinor).toBe(0);
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
