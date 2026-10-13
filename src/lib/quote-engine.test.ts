import { describe, expect, it } from "vitest";
import golden from "./fixtures/quote-golden.json";
import reference from "./fixtures/pricing-config.reference.json";
import {
  customerRate, DEFAULT_PRICING_CONFIG, deliveryFee, effectiveTaxRate, estimateLanded, parsePricingConfig, quote, serviceCharge, shippingPrice,
  type QuoteCart, type QuoteCtx, type QuoteOptions,
} from "./quote-engine";

const REF = parsePricingConfig(reference);
if (!REF.ok) throw new Error(REF.error);

describe("quote engine matches the reference implementation", () => {
  // The golden file was produced by running the reference quote-engine.js on these carts, with its own configuration.
  for (const g of golden as { name: string; cart: QuoteCart; ctx: QuoteCtx; opts: QuoteOptions; customerView: unknown; internal: unknown }[]) {
    it(g.name, () => {
      const q = quote(g.cart, g.ctx, g.opts, REF.value);
      expect(q.customerView).toEqual(g.customerView);
      expect(q.internal).toEqual(g.internal);
    });
  }

  it("keeps the customer total equal to its parts", () => {
    for (const g of golden as { customerView: { itemsSubtotalGhs: number; deliveryAndImportChargesGhs: number; totalGhs: number } }[]) {
      const v = g.customerView;
      expect(Math.round((v.itemsSubtotalGhs + v.deliveryAndImportChargesGhs) * 100) / 100).toBeCloseTo(v.totalGhs, 2);
    }
  });
});

describe("pricing rules", () => {
  const cfg = DEFAULT_PRICING_CONFIG;
  it("marks the rate up by 3% in a calm market and more when it moves", () => {
    expect(customerRate(15.55, 0.004, cfg)).toEqual({ rate: 16.02, markup: 0.0302 });
    expect(customerRate(15.55, 0.015, cfg).markup).toBeGreaterThan(customerRate(15.55, 0.004, cfg).markup);
    expect(customerRate(15.55, 0.05, cfg).markup).toBeGreaterThan(customerRate(15.55, 0.015, cfg).markup);
  });
  it("works out import tax on CIF for a duty band", () => {
    expect(effectiveTaxRate(0.2, cfg)).toBeCloseTo(0.462, 3);
    expect(effectiveTaxRate(0, cfg)).toBeCloseTo(0.222, 3);
  });
  it("charges the service fee in marginal tiers, with a minimum and a cap", () => {
    expect(serviceCharge(100, cfg)).toBe(60); // minimum
    expect(serviceCharge(1000, cfg)).toBe(120);
    expect(serviceCharge(2000, cfg)).toBe(210); // 1000 at 12% then 1000 at 9%
    expect(serviceCharge(1_000_000, cfg)).toBe(600); // cap
  });
  it("prices shipping by band and per kg above the top band", () => {
    expect(shippingPrice(0.5, cfg)).toBe(160);
    expect(shippingPrice(2, cfg)).toBe(340);
    expect(shippingPrice(10, cfg)).toBe(950);
    expect(shippingPrice(12, cfg)).toBe(1140);
  });
  it("prices delivery by zone, and other regions by weight, and treats an unknown zone as other regions", () => {
    expect(deliveryFee("accra_central", 5, cfg)).toBe(40);
    expect(deliveryFee("other_regions", 5, cfg)).toBe(100);
    expect(deliveryFee("somewhere_new", 2, cfg)).toBe(70);
  });
  it("prices an unrecognised category as unknown (35% duty) and flags it for review", () => {
    const q = quote({ zone: "accra_central", lines: [{ sku: "x", category: "made_up", unitGbp: 100, qty: 1, weightKg: 1 }] }, { midGbpGhs: 15.55, customsGbpGhs: 15.55 }, {}, cfg);
    expect(q.internal.flags).toEqual(expect.arrayContaining(["unknown_category:x", "manual_review:x"]));
  });
  it("lifts the service charge when an order would earn less than the contribution floor", () => {
    const q = quote({ zone: "other_regions", lines: [{ sku: "t", category: "books_stationery", unitGbp: 30, qty: 1, weightKg: 9 }] }, { midGbpGhs: 15.55, customsGbpGhs: 15.55 }, {}, cfg);
    expect(q.internal.contributionGhs).toBeGreaterThanOrEqual(cfg.contributionFloorGhs - 0.01);
  });
  it("estimates the landed price of one unit without the minimum order", () => {
    const e = estimateLanded({ sku: "k", category: "kitchen_home", unitGbp: 10, weightKg: 1 }, "accra_central", { midGbpGhs: 15.55, customsGbpGhs: 15.55 }, cfg);
    expect(e).toBeGreaterThan(300);
  });
  it("ships with economy sea switched off until the owner turns it on", () => {
    expect(cfg.shipping.sea.enabled).toBe(false);
    const q = quote({ zone: "accra_central", lines: [{ sku: "s", category: "kitchen_home", unitGbp: 150, qty: 1, weightKg: 9 }] }, { midGbpGhs: 15.55, customsGbpGhs: 15.55 }, { service: "sea" }, cfg);
    expect(q.customerView.service).toBe("express_air");
    expect(q.internal.flags).toContain("sea_not_available_using_air");
  });
});

describe("configuration checks", () => {
  const base = () => JSON.parse(JSON.stringify(DEFAULT_PRICING_CONFIG));
  it("accepts the shipped configuration", () => {
    expect(parsePricingConfig(base()).ok).toBe(true);
  });
  it("rejects bad shapes with a plain message", () => {
    const a = base(); a.shipping.bands.reverse();
    expect(parsePricingConfig(a)).toMatchObject({ ok: false, error: expect.stringContaining("bands") });
    const b = base(); delete b.delivery.other_regions;
    expect(parsePricingConfig(b)).toMatchObject({ ok: false, error: expect.stringContaining("other_regions") });
    const c = base(); c.categories = c.categories.filter((k: { id: string }) => k.id !== "unknown");
    expect(parsePricingConfig(c)).toMatchObject({ ok: false, error: expect.stringContaining("unknown") });
    const d = base(); d.serviceCharge.marginalTiers[0].upToGhs = null;
    expect(parsePricingConfig(d).ok).toBe(false);
    const e = base(); e.tax.vatStackPct = 5;
    expect(parsePricingConfig(e).ok).toBe(false);
    expect(parsePricingConfig("nope").ok).toBe(false);
  });
});
