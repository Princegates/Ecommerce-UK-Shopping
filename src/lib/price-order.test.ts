import { describe, expect, it } from "vitest";
import { openForTest } from "./db";
import { getProductById, listProducts } from "./catalog";
import { upsertProduct, upsertZone } from "./admin";
import { customerOf, priceOrder } from "./price-order";
import { sampleQuotes } from "./quote-samples";
import { getSettings, getZones } from "./settings";

const basket = (d: ReturnType<typeof openForTest>, over: Partial<{ gbp: number; kg: number; category: string; zone: string; qty: number }> = {}) => {
  const s = getSettings(d);
  return priceOrder({
    items: [{ id: "a", unitPriceMinor: Math.round((over.gbp ?? 80) * 100), quantity: over.qty ?? 1, weightGrams: (over.kg ?? 2) * 1000, category: over.category ?? "kitchen_home" }],
    pricing: s.pricing, market: s.market, zoneKey: over.zone ?? "accra_central", ignoreMinOrder: true,
  });
};

describe("priceOrder adapter", () => {
  it("the parts add up to the total, and the customer view adds up too", () => {
    const d = openForTest();
    const b = basket(d);
    expect(b.totalMinor).toBe(b.itemsGhsMinor + b.serviceFeeMinor + b.shippingMinor + b.insuranceMinor + b.dutyMinor + b.deliveryMinor);
    const c = customerOf(b);
    expect(c.itemsMinor + c.deliveryAndImportMinor).toBe(c.totalMinor);
    expect(c.lines.reduce((n, l) => n + l.ghsMinor, 0)).toBe(c.itemsMinor);
  });

  it("never leaks the shop's own working into the customer view", () => {
    const d = openForTest();
    const json = JSON.stringify(customerOf(basket(d)));
    for (const word of ["contribution", "internal", "serviceFeeMinor", "dutyMinor", "insuranceMinor", "shippingMinor"]) expect(json).not.toContain(word);
  });

  it("an unknown category is flagged and charged more than a known one", () => {
    const d = openForTest();
    const known = basket(d, { category: "books_stationery" });
    const unknown = basket(d, { category: "unknown" });
    expect(unknown.flags.some((f) => f.startsWith("manual_review"))).toBe(true);
    expect(unknown.dutyMinor).toBeGreaterThan(known.dutyMinor);
  });

  it("an empty price prices at zero", () => {
    const d = openForTest();
    expect(basket(d, { gbp: 0 }).totalMinor).toBe(0);
  });

  it("flags an over-weight item and an under-minimum order", () => {
    const d = openForTest();
    expect(basket(d, { kg: 90 }).below.overWeight).toBe(true);
    const s = getSettings(d);
    const small = priceOrder({ items: [{ id: "a", unitPriceMinor: 100, quantity: 1, weightGrams: 100, category: "books_stationery" }], pricing: s.pricing, market: s.market, zoneKey: "accra_central" });
    expect(small.below.minimumOrder).toBe(true);
  });

  it("the sample baskets show a positive contribution", () => {
    const d = openForTest();
    for (const q of sampleQuotes(undefined, d)) expect(q.contribution).toBeGreaterThan(0);
  });
});

describe("zones and products", () => {
  it("seeded areas carry a delivery price key that the configuration knows", () => {
    const d = openForTest();
    const keys = Object.keys(getSettings(d).pricing.delivery);
    for (const z of getZones(false, d)) expect(keys).toContain(z.pricingKey);
  });

  it("a new area keeps its pricing key", () => {
    const d = openForTest();
    upsertZone({ id: 0, name: "Tema", areas: "", pricingKey: "accra_central", eta: "", active: true, sort: 50 }, d);
    expect(getZones(true, d).find((z) => z.name === "Tema")?.pricingKey).toBe("accra_central");
  });

  it("a product's duty category is worked out from its name unless set by hand", () => {
    const d = openForTest();
    const shopId = listProducts({}, d)[0].shopId;
    const base = { id: 0, shopId, brand: "", category: "", description: "", priceMinor: 1000, weightGrams: 300, options: [], imageUrl: "", sourceUrl: "", active: true, compareAtMinor: null, dealEndsAt: null };
    const auto = upsertProduct({ ...base, name: "Cotton t-shirt" }, d);
    expect(getProductById(auto, d)!.dutyCategory).toBe("clothing_apparel");
    const manual = upsertProduct({ ...base, name: "Cotton t-shirt", dutyCategory: "books_stationery" }, d);
    expect(getProductById(manual, d)!.dutyCategory).toBe("books_stationery");
    const odd = upsertProduct({ ...base, name: "Zorblat" }, d);
    expect(getProductById(odd, d)!.dutyCategory).toBe("unknown");
  });
});
