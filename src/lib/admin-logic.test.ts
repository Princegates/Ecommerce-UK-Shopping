import { describe, expect, it } from "vitest";
import { openForTest } from "./db";
import { actionQueue, bestSellerIds, change, customerStats, kpis, margins, parseRange, pipeline, salesByDay, topAreas, topItems, topShops } from "./analytics";
import { audit, recentAudit } from "./audit";
import { getProductById, listProducts } from "./catalog";
import type { CartLine } from "./cart";
import { rateAgeDays, rateHistory, setExchangeRate, validateRate } from "./fx";
import { EMPTY_COSTS, getCosts, orderMargin, saveCosts } from "./margin";
import { createOrder, markPaid, staffSetStatus } from "./orders";
import { getSettings, getShippingMethods, getZones } from "./settings";

function shop() {
  const d = openForTest();
  const products = listProducts({}, d);
  const make = (productIdx = 0, qty = 1, daysAgo = 0, paid = true) => {
    const p = products[productIdx];
    const line: CartLine = { itemId: p.id, product: getProductById(p.id, d)!, quantity: qty, options: {} };
    const r = createOrder([line], {
      customerName: "Ama Mensah", phone: "0241234567", email: "", zoneId: getZones(true, d)[0].id, address: "12 Example Street",
      landmark: "", notes: "", shippingCode: getShippingMethods(true, d)[0].code,
    }, d);
    if (!r.ok) throw new Error(r.error);
    if (paid) markPaid(r.paymentRef, d);
    d.prepare("UPDATE orders SET created_at = datetime('now', ?) WHERE payment_ref = ?").run(`-${daysAgo} days`, r.paymentRef);
    const id = (d.prepare("SELECT id FROM orders WHERE payment_ref = ?").get(r.paymentRef) as { id: number }).id;
    return { id, ref: r.paymentRef, number: r.number };
  };
  return { d, make, products };
}

describe("exchange rate", () => {
  it("validates, saves, keeps history and tracks staleness", () => {
    const { d } = shop();
    expect(validateRate(0, 0)).toBeTruthy();
    expect(validateRate(0.5, 0)).toBeTruthy();
    expect(validateRate(15, 60)).toBeTruthy();
    expect(validateRate(15.2, 3)).toBeNull();
    expect(setExchangeRate(-1, 0, "", d).ok).toBe(false);
    expect(rateAgeDays(d)).toBeNull();
    expect(setExchangeRate(16.1, 2.5, "Market moved", d).ok).toBe(true);
    expect(getSettings(d).fx).toEqual({ rate: 16.1, markupPct: 2.5 });
    expect(rateHistory(10, d)[0]).toMatchObject({ rate: 16.1, markupPct: 2.5, note: "Market moved" });
    expect(rateAgeDays(d)).toBe(0);
    d.prepare("UPDATE fx_rate_history SET changed_at = datetime('now', '-4 days')").run();
    expect(rateAgeDays(d)).toBe(4);
  });
});

describe("margin", () => {
  it("works out cost and margin in cedis", () => {
    const m = orderMargin(250000, 15.2, { ...EMPTY_COSTS, retailerGbpMinor: 6499, ukDeliveryGbpMinor: 399, purchaseRate: 15, freightGhsMinor: 9000, localDeliveryGhsMinor: 3000, paymentFeesGhsMinor: 4000, otherGhsMinor: 0 });
    expect(m.costMinor).toBe(Math.round((6499 + 399) * 15) + 9000 + 3000 + 4000);
    expect(m.marginMinor).toBe(250000 - m.costMinor);
    expect(m.marginPct).toBeCloseTo(m.marginMinor / 250000);
  });
  it("falls back to the quoted rate when no purchase rate is given and survives zero revenue", () => {
    expect(orderMargin(100000, 15, { ...EMPTY_COSTS, retailerGbpMinor: 1000 }).rateUsed).toBe(15);
    expect(orderMargin(0, 15, EMPTY_COSTS).marginPct).toBeNull();
  });
  it("saves and updates costs per order", () => {
    const { d, make } = shop();
    const o = make();
    expect(getCosts(o.id, d)).toBeNull();
    saveCosts(o.id, { ...EMPTY_COSTS, retailerGbpMinor: 5000, note: "first" }, d);
    saveCosts(o.id, { ...EMPTY_COSTS, retailerGbpMinor: 5500, note: "second" }, d);
    expect(getCosts(o.id, d)).toMatchObject({ retailerGbpMinor: 5500, note: "second" });
  });
});

describe("dashboard analytics", () => {
  it("totals paid orders in range and compares with the previous period", () => {
    const { d, make } = shop();
    make(0, 1, 1);
    make(1, 2, 2);
    make(0, 1, 40); // previous 30-day period
    make(2, 1, 1, false); // unpaid, ignored
    const k = kpis(30, d);
    expect(k.orders).toBe(2);
    expect(k.revenueMinor).toBe((d.prepare("SELECT SUM(total_minor) AS t FROM orders WHERE payment_status = 'PAID' AND created_at >= datetime('now', '-30 days')").get() as { t: number }).t);
    expect(k.previous.orders).toBe(1);
    expect(k.averageOrderMinor).toBe(Math.round(k.revenueMinor / 2));
    expect(change(2, 1)).toBe(1);
    expect(change(0, 0)).toBe(0);
    expect(change(3, 0)).toBeNull();
  });
  it("fills every day of the range, including quiet ones", () => {
    const { d, make } = shop();
    make(0, 1, 2);
    const days = salesByDay(7, d);
    expect(days).toHaveLength(7);
    expect(days.reduce((n, x) => n + x.orders, 0)).toBe(1);
    expect(new Set(days.map((x) => x.day)).size).toBe(7);
  });
  it("ranks shops, items and areas and finds best sellers", () => {
    const { d, make, products } = shop();
    make(0, 3, 1);
    make(1, 1, 1);
    make(6, 1, 1);
    const shops = topShops(30, 5, d);
    expect(shops.length).toBeGreaterThan(1);
    expect(shops[0].revenueMinor).toBeGreaterThanOrEqual(shops[1].revenueMinor);
    expect(topItems(30, 5, d)[0]).toMatchObject({ name: products[0].name, units: 3 });
    expect(topAreas(30, d)[0].orders).toBe(3);
    expect(bestSellerIds(3, d)[0]).toBe(products[0].id);
    expect(pipeline(d).find((s) => s.status === "PAID")?.count).toBe(3);
  });
  it("reports margin only on costed orders and counts the rest", () => {
    const { d, make } = shop();
    const a = make(0, 1, 1);
    make(1, 1, 1);
    saveCosts(a.id, { ...EMPTY_COSTS, retailerGbpMinor: 5000, freightGhsMinor: 9000 }, d);
    const m = margins(30, d);
    expect(m.ordersCosted).toBe(1);
    expect(m.ordersMissingCosts).toBe(1);
    expect(m.marginMinor).toBe(m.revenueMinor - m.costMinor);
  });
  it("builds the action queue from real conditions and drops empty items", () => {
    const { d, make } = shop();
    expect(actionQueue(5, d)).toEqual([]);
    const a = make(0, 1, 0);
    make(1, 1, 2, false);
    d.prepare("UPDATE orders SET created_at = datetime('now', '-2 days') WHERE status = 'AWAITING_PAYMENT'").run();
    d.prepare("INSERT INTO link_requests (url, name, phone) VALUES ('https://x.example/a', 'A', '0241234567')").run();
    const keys = () => actionQueue(5, d).map((i) => i.key);
    expect(keys()).toEqual(expect.arrayContaining(["tobuy", "unpaid", "requests"]));
    expect(keys()).not.toContain("refund");
    staffSetStatus(a.id, "CANCELLED", "", d);
    expect(keys()[0]).toBe("refund"); // urgent items first
    d.prepare("UPDATE order_events SET created_at = datetime('now', '-9 days')").run();
    staffSetStatus(a.id, "REFUNDED", "", d);
    expect(keys()).not.toContain("refund");
  });
  it("counts customer accounts", () => {
    const { d } = shop();
    expect(customerStats(30, d)).toMatchObject({ accounts: 0, repeat: 0 });
  });
  it("parses the range selector safely", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("90")).toBe(90);
    expect(parseRange("1; DROP TABLE orders")).toBe(30);
    expect(parseRange(undefined)).toBe(30);
  });
});

describe("audit log", () => {
  it("records and searches actions", () => {
    const { d } = shop();
    audit("rate.update", "fx", "15.2 to 16.1", d);
    audit("integration.save", "stripe", "key changed", d);
    expect(recentAudit(10, undefined, d)).toHaveLength(2);
    expect(recentAudit(10, "stripe", d).map((a) => a.action)).toEqual(["integration.save"]);
    expect(recentAudit(10, "%", d)).toHaveLength(0); // wildcards are escaped
  });
});
