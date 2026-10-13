import { describe, expect, it } from "vitest";
import { openForTest } from "./db";
import { upsertProduct, upsertShop, upsertZone } from "./admin";
import { listProducts, listShops } from "./catalog";
import { getSettings, setSetting, getShippingMethods, getZones } from "./settings";
import { createOrder, getOrderByRef, markPaid, staffSetStatus, findOrderForTracking, quoteCart } from "./orders";
import type { CartLine } from "./cart";
import { getProductById } from "./catalog";

describe("admin writes", () => {
  it("creates shops and products with unique slugs", () => {
    const d = openForTest();
    const shopId = upsertShop({ id: 0, name: "Northgate Fashion", tagline: "", category: "Fashion", websiteUrl: "", description: "", accent: "#123456", active: true, sort: 9 }, d);
    expect(listShops({}, d).filter((s) => s.name === "Northgate Fashion")).toHaveLength(2);
    const p1 = upsertProduct({ id: 0, shopId, name: "Hat", brand: "", category: "", description: "", priceMinor: 1000, weightGrams: 100, options: [], imageUrl: "", sourceUrl: "", active: true, compareAtMinor: null, dealEndsAt: null }, d);
    const p2 = upsertProduct({ id: 0, shopId, name: "Hat", brand: "", category: "", description: "", priceMinor: 1200, weightGrams: 100, options: [], imageUrl: "", sourceUrl: "", active: true, compareAtMinor: null, dealEndsAt: null }, d);
    expect(p1).not.toBe(p2);
    const hats = listProducts({ shopId }, d);
    expect(new Set(hats.map((h) => h.slug)).size).toBe(2);
  });

  it("hides inactive shops and their products from customers", () => {
    const d = openForTest();
    const shop = listShops({}, d)[0];
    const before = listProducts({}, d).length;
    upsertShop({ id: shop.id, name: shop.name, tagline: shop.tagline, category: shop.category, websiteUrl: "", description: "", accent: shop.accent, active: false, sort: 0 }, d);
    expect(listProducts({}, d).length).toBe(before - shop.productCount);
  });
});

function lineFor(d: ReturnType<typeof openForTest>, productId: number, quantity: number): CartLine {
  const product = getProductById(productId, d)!;
  return { itemId: productId, product, quantity, options: {} };
}

describe("orders", () => {
  it("prices from the quote engine: the parts add up to the total", () => {
    const d = openForTest();
    const product = listProducts({}, d)[0];
    const zone = getZones(true, d)[0];
    const method = getShippingMethods(true, d)[0];
    const q = quoteCart([lineFor(d, product.id, 2)], zone.id, method.code, d);
    expect(q.ok).toBe(true);
    if (!q.ok) return;
    const b = q.breakdown;
    expect(b.itemsGbpMinor).toBe(product.priceMinor * 2);
    expect(b.serviceFeeMinor).toBeGreaterThan(0);
    expect(b.shippingMinor).toBeGreaterThan(0);
    expect(b.insuranceMinor).toBeGreaterThan(0);
    expect(b.dutyMinor).toBeGreaterThan(0);
    expect(b.totalMinor).toBe(b.itemsGhsMinor + b.serviceFeeMinor + b.shippingMinor + b.insuranceMinor + b.dutyMinor + b.deliveryMinor);
    // the customer's item lines carry the service charge, and add up to items plus service charge
    expect(b.lines.reduce((n, l) => n + l.ghsMinor, 0)).toBe(b.itemsGhsMinor + b.serviceFeeMinor);
  });

  it("a dearer delivery area never costs less", () => {
    const d = openForTest();
    const product = listProducts({}, d)[0];
    const zones = getZones(true, d);
    const method = getShippingMethods(true, d)[0];
    const near = quoteCart([lineFor(d, product.id, 1)], zones[0].id, method.code, d);
    const far = quoteCart([lineFor(d, product.id, 1)], zones[zones.length - 1].id, method.code, d);
    expect(near.ok && far.ok).toBe(true);
    if (near.ok && far.ok) expect(far.breakdown.deliveryMinor).toBeGreaterThanOrEqual(near.breakdown.deliveryMinor);
  });

  it("creates an order that is paid exactly once and tracked by number plus contact", () => {
    const d = openForTest();
    const product = listProducts({}, d)[0];
    const zone = getZones(true, d)[0];
    const method = getShippingMethods(true, d)[0];
    const res = createOrder([lineFor(d, product.id, 1)], {
      customerName: "Ama Mensah", phone: "024 123 4567", email: "ama@example.com", zoneId: zone.id,
      address: "12 Example Street", landmark: "", notes: "", shippingCode: method.code,
    }, d);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.number).toMatch(/^UKG-\d{4}-\d{6}$/);
    expect(getOrderByRef(res.paymentRef, d)?.status).toBe("AWAITING_PAYMENT");
    const placed = getOrderByRef(res.paymentRef, d)!;
    expect(placed.insuranceMinor).toBeGreaterThan(0);
    expect(placed.dutyMinor).toBeGreaterThan(0);
    expect(placed.totalMinor).toBe(placed.itemsGhsMinor + placed.serviceFeeMinor + placed.shippingMinor + placed.insuranceMinor + placed.dutyMinor + placed.deliveryMinor);

    expect(markPaid(res.paymentRef, d)).toBe(true);
    expect(markPaid(res.paymentRef, d)).toBe(false);
    const order = getOrderByRef(res.paymentRef, d)!;
    expect(order.status).toBe("PAID");

    expect(findOrderForTracking(res.number, "0241234567", d)?.id).toBe(order.id);
    expect(findOrderForTracking(res.number, "AMA@example.com", d)?.id).toBe(order.id);
    expect(findOrderForTracking(res.number, "0249999999", d)).toBeNull();
    expect(findOrderForTracking(res.number, "", d)).toBeNull();

    expect(staffSetStatus(order.id, "DELIVERED", "", d).ok).toBe(false);
    expect(staffSetStatus(order.id, "PURCHASING", "buying now", d).ok).toBe(true);
    expect(getOrderByRef(res.paymentRef, d)?.status).toBe("PURCHASING");
  });

  it("enforces the minimum order, the weight limit and an empty cart", () => {
    const d = openForTest();
    const product = listProducts({}, d)[0];
    const zone = getZones(true, d)[0];
    const method = getShippingMethods(true, d)[0];
    const details = { customerName: "A B", phone: "0241234567", email: "", zoneId: zone.id, address: "12 Example St", landmark: "", notes: "", shippingCode: method.code };
    expect(createOrder([], details, d).ok).toBe(false);

    const cfg = { ...getSettings(d).pricing, minOrderGhs: 1_000_000 };
    setSetting("pricing_config", cfg, d);
    const tooSmall = createOrder([lineFor(d, product.id, 1)], details, d);
    expect(tooSmall.ok).toBe(false);
    if (!tooSmall.ok) expect(tooSmall.error).toMatch(/minimum order/i);

    setSetting("pricing_config", { ...cfg, minOrderGhs: 0 }, d);
    const heavy = { ...lineFor(d, product.id, 1), product: { ...getProductById(product.id, d)!, weightGrams: 90_000 } };
    const tooHeavy = createOrder([heavy], details, d);
    expect(tooHeavy.ok).toBe(false);
    if (!tooHeavy.ok) expect(tooHeavy.error).toMatch(/too heavy/i);
  });

  it("zones can be added", () => {
    const d = openForTest();
    upsertZone({ id: 0, name: "Test zone", areas: "", pricingKey: "accra_central", eta: "", active: true, sort: 99 }, d);
    expect(getZones(true, d).some((z) => z.name === "Test zone")).toBe(true);
  });
});
