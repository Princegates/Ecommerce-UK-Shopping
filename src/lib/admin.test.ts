import { describe, expect, it } from "vitest";
import { openForTest } from "./db";
import { upsertMethod, upsertProduct, upsertShop, upsertZone } from "./admin";
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

  it("rejects duplicate shipping method names", () => {
    const d = openForTest();
    const card = { brackets: [{ upToGrams: 1000, priceMinor: 100 }], extraPerKgMinor: 0, minChargeMinor: 0 };
    expect(upsertMethod({ id: 0, code: "", name: "Air freight", eta: "", rateCard: card, active: true, sort: 5 }, d).ok).toBe(false);
    expect(upsertMethod({ id: 0, code: "", name: "Sea freight", eta: "", rateCard: card, active: true, sort: 5 }, d).ok).toBe(true);
  });
});

function lineFor(d: ReturnType<typeof openForTest>, productId: number, quantity: number): CartLine {
  const product = getProductById(productId, d)!;
  return { itemId: productId, product, quantity, options: {} };
}

describe("orders", () => {
  it("prices from live settings: items + service charge + shipping + delivery", () => {
    const d = openForTest();
    setSetting("fx_rate", 10, d);
    setSetting("fx_markup_pct", 0, d);
    setSetting("service_fee", { mode: "fixed", fixedMinor: 5000 }, d);
    const product = listProducts({}, d)[0];
    const zone = getZones(true, d)[0];
    const method = getShippingMethods(true, d)[0];
    const q = quoteCart([lineFor(d, product.id, 2)], zone.id, method.code, d);
    expect(q.ok).toBe(true);
    if (!q.ok) return;
    expect(q.breakdown.itemsGhsMinor).toBe(product.priceMinor * 2 * 10);
    expect(q.breakdown.serviceFeeMinor).toBe(5000);
    expect(q.breakdown.deliveryMinor).toBe(zone.feeMinor);
    expect(q.breakdown.totalMinor).toBe(q.breakdown.itemsGhsMinor + 5000 + q.breakdown.shippingMinor + zone.feeMinor);
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

  it("enforces the minimum order and an empty cart", () => {
    const d = openForTest();
    setSetting("min_order_gbp_minor", 1_000_000, d);
    const product = listProducts({}, d)[0];
    const zone = getZones(true, d)[0];
    const method = getShippingMethods(true, d)[0];
    const details = { customerName: "A B", phone: "0241234567", email: "", zoneId: zone.id, address: "12 Example St", landmark: "", notes: "", shippingCode: method.code };
    expect(createOrder([lineFor(d, product.id, 1)], details, d).ok).toBe(false);
    expect(createOrder([], details, d).ok).toBe(false);
    expect(getSettings(d).minOrderGbpMinor).toBe(1_000_000);
  });

  it("zones can be added", () => {
    const d = openForTest();
    upsertZone({ id: 0, name: "Test zone", areas: "", feeMinor: 100, eta: "", active: true, sort: 99 }, d);
    expect(getZones(true, d).some((z) => z.name === "Test zone")).toBe(true);
  });
});
