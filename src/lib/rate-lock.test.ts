import { describe, expect, it } from "vitest";
import { openForTest } from "./db";
import { listProducts, getProductById } from "./catalog";
import { createOrder, quoteCart } from "./orders";
import { quoteMarket } from "./rate-lock";
import { setExchangeRate } from "./fx";
import { getSettings, getShippingMethods, getZones, setSetting } from "./settings";
import type { CartLine } from "./cart";

const T0 = new Date("2026-10-13T12:00:00Z");
const mins = (m: number) => new Date(T0.getTime() + m * 60_000);
const reading = (rate: number, at = T0) => ({ rate, fetchedAt: at.toISOString(), asOf: null });

describe("quote lock", () => {
  it("holds the rate for 30 minutes, then takes the new one", () => {
    const d = openForTest();
    setExchangeRate(15, 0, "", d);
    const a = quoteMarket("cart-1", d, T0);
    expect(a.market.mid).toBe(15);
    expect(a.lockedUntil).toBe(mins(30).toISOString());
    setExchangeRate(16, 0, "", d);
    expect(quoteMarket("cart-1", d, mins(29)).market.mid).toBe(15); // still held
    expect(quoteMarket("cart-1", d, mins(29)).fx.rate).toBe(a.fx.rate);
    const later = quoteMarket("cart-1", d, mins(31));
    expect(later.market.mid).toBe(16);
    expect(later.lockedUntil).toBe(mins(61).toISOString());
  });

  it("holds each shopper's rate separately, and does nothing without a key or when only peeking", () => {
    const d = openForTest();
    setExchangeRate(15, 0, "", d);
    quoteMarket("a", d, T0);
    setExchangeRate(16, 0, "", d);
    expect(quoteMarket("b", d, mins(5)).market.mid).toBe(16);
    expect(quoteMarket(null, d, mins(5)).lockedUntil).toBeNull();
    expect(quoteMarket("c", d, mins(5), { create: false }).lockedUntil).toBeNull();
    expect(d.prepare("SELECT COUNT(*) AS n FROM rate_locks WHERE lock_key = 'c'").get()).toEqual({ n: 0 });
  });

  it("holds new quotes when the sources disagree, but honours a quote already held", () => {
    const d = openForTest();
    setExchangeRate(15, 0, "", d);
    const held = quoteMarket("held", d, T0);
    expect(held.frozen).toBe(false);
    setSetting("fx_sources", { allratestoday: reading(15.9, mins(1)), bank_of_ghana: reading(16.3, mins(1)) }, d);
    const fresh = quoteMarket("new", d, mins(2));
    expect(fresh.frozen).toBe(true);
    expect(fresh.lockedUntil).toBeNull();
    expect(fresh.spread).toBeGreaterThan(0.015);
    expect(quoteMarket("held", d, mins(2))).toMatchObject({ frozen: false, lockedUntil: held.lockedUntil });
    // once they agree again the shopper can be quoted
    setSetting("fx_sources", { allratestoday: reading(15.9, mins(3)), bank_of_ghana: reading(15.95, mins(3)) }, d);
    expect(quoteMarket("new", d, mins(4)).frozen).toBe(false);
  });
});

describe("orders and the lock", () => {
  const lineFor = (d: ReturnType<typeof openForTest>, qty = 1): CartLine => {
    const p = getProductById(listProducts({}, d)[0].id, d)!;
    return { itemId: p.id, product: p, quantity: qty, options: {} };
  };
  const details = (d: ReturnType<typeof openForTest>) => ({
    customerName: "Ama Mensah", phone: "0241234567", email: "", zoneId: getZones(true, d)[0].id, address: "12 Example St", landmark: "", notes: "", shippingCode: getShippingMethods(true, d)[0].code,
  });

  it("prices the order at the held rate, not today's", () => {
    const d = openForTest();
    setExchangeRate(15, 0, "", d);
    const line = lineFor(d);
    const shown = quoteMarket("tok", d, new Date());
    const quoteAtLock = quoteCart([line], details(d).zoneId, details(d).shippingCode, d, shown.market);
    setExchangeRate(15.6, 0, "", d); // the market moves while they check out
    const res = createOrder([line], details(d), d, { lockKey: "tok", expectedTotalMinor: quoteAtLock.ok ? quoteAtLock.breakdown.totalMinor : 0 });
    expect(res.ok).toBe(true);
    const row = d.prepare("SELECT total_minor FROM orders ORDER BY id DESC LIMIT 1").get() as { total_minor: number };
    expect(quoteAtLock.ok && row.total_minor === quoteAtLock.breakdown.totalMinor).toBe(true);
  });

  it("refuses an order whose price moved since it was shown, and says the new total", () => {
    const d = openForTest();
    const line = lineFor(d);
    const res = createOrder([line], details(d), d, { lockKey: "tok2", expectedTotalMinor: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/price changed.*new total is GH₵/);
  });

  it("refuses to place an order while quoting is on hold", () => {
    const d = openForTest();
    const now = new Date();
    setSetting("fx_sources", { allratestoday: reading(15.9, now), bank_of_ghana: reading(16.5, now) }, d);
    const res = createOrder([lineFor(d)], details(d), d, { lockKey: "tok3" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/exchange rate/i);
    expect(getSettings(d).fxSources.allratestoday?.rate).toBe(15.9);
  });
});
