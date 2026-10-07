import { describe, expect, it } from "vitest";
import { openForTest } from "./db";
import { deleteShop } from "./admin";
import { getProductById, listProducts, listShops } from "./catalog";
import { createOrder } from "./orders";
import { seedIfEmpty } from "./seed";
import { getShippingMethods, getZones } from "./settings";
import type { CartLine } from "./cart";

describe("deleting a shop", () => {
  it("removes the shop, its items, baskets and sources, and keeps placed orders intact", () => {
    const d = openForTest();
    const shops = listShops({ includeInactive: true }, d);
    const doomed = shops[0];
    const kept = shops[1];
    const product = listProducts({ shopId: doomed.id }, d)[0];
    const p = getProductById(product.id, d)!;
    const line: CartLine = { itemId: p.id, product: p, quantity: 1, options: {} };
    const order = createOrder([line], {
      customerName: "Ama Mensah", phone: "0241234567", email: "", zoneId: getZones(true, d)[0].id, address: "12 Example Street",
      landmark: "", notes: "", shippingCode: getShippingMethods(true, d)[0].code,
    }, d);
    expect(order.ok).toBe(true);
    d.prepare("INSERT INTO carts (token) VALUES ('t')").run();
    d.prepare("INSERT INTO cart_items (cart_token, product_id, quantity, options) VALUES ('t', ?, 1, '{}')").run(product.id);
    d.prepare("INSERT INTO catalog_sources (shop_id, name, kind) VALUES (?, 'Feed', 'feed_csv')").run(doomed.id);
    const before = (d.prepare("SELECT COUNT(*) AS n FROM products WHERE shop_id = ?").get(doomed.id) as { n: number }).n;
    expect(before).toBeGreaterThan(0);

    const r = deleteShop(doomed.id, d);
    expect(r).toEqual({ ok: true, products: before, sources: 1 });
    expect(listShops({ includeInactive: true }, d).map((s) => s.id)).not.toContain(doomed.id);
    expect(d.prepare("SELECT COUNT(*) AS n FROM products WHERE shop_id = ?").get(doomed.id)).toEqual({ n: 0 });
    expect(d.prepare("SELECT COUNT(*) AS n FROM cart_items").get()).toEqual({ n: 0 });
    expect(d.prepare("SELECT COUNT(*) AS n FROM catalog_sources WHERE shop_id = ?").get(doomed.id)).toEqual({ n: 0 });
    expect((d.prepare("SELECT COUNT(*) AS n FROM order_items").get() as { n: number }).n).toBe(1); // history survives
    expect(listShops({}, d).some((s) => s.id === kept.id)).toBe(true);
    expect(d.pragma("foreign_key_check")).toEqual([]);
    expect(deleteShop(doomed.id, d)).toMatchObject({ ok: false });
  });

  it("will not delete while a catalogue run is in progress", () => {
    const d = openForTest();
    const shop = listShops({}, d)[0];
    const now = Date.parse("2026-10-07T12:00:00Z");
    d.prepare("INSERT INTO catalog_sources (shop_id, name, kind, running_since) VALUES (?, 'Feed', 'feed_csv', '2026-10-07 11:50:00')").run(shop.id);
    expect(deleteShop(shop.id, d, now)).toMatchObject({ ok: false });
    expect(deleteShop(shop.id, d, now + 60 * 60_000)).toMatchObject({ ok: true });
  });

  it("does not bring the starter data back when every shop has been deleted", () => {
    const d = openForTest();
    for (const s of listShops({ includeInactive: true }, d)) deleteShop(s.id, d);
    const methods = (d.prepare("SELECT COUNT(*) AS n FROM shipping_methods").get() as { n: number }).n;
    d.prepare("UPDATE settings SET value = '20.5' WHERE key = 'fx_rate'").run();
    expect(() => seedIfEmpty(d, { sample: false })).not.toThrow(); // what happens at every restart
    expect(listShops({ includeInactive: true }, d)).toEqual([]);
    expect((d.prepare("SELECT COUNT(*) AS n FROM shipping_methods").get() as { n: number }).n).toBe(methods);
    expect(d.prepare("SELECT value FROM settings WHERE key = 'fx_rate'").get()).toEqual({ value: "20.5" });
  });
});

describe("deleting a delivery area", () => {
  it("removes it, keeps placed orders' area name and fee, and keeps at least one area available", async () => {
    const { deleteZone, upsertZone } = await import("./admin");
    const d = openForTest();
    const zones = getZones(true, d);
    const first = zones[0];
    const product = listProducts({}, d)[0];
    const p = getProductById(product.id, d)!;
    const order = createOrder([{ itemId: p.id, product: p, quantity: 1, options: {} }], {
      customerName: "Ama Mensah", phone: "0241234567", email: "", zoneId: first.id, address: "12 Example Street", landmark: "", notes: "", shippingCode: getShippingMethods(true, d)[0].code,
    }, d);
    expect(order.ok).toBe(true);
    expect(deleteZone(first.id, d)).toEqual({ ok: true, name: first.name });
    expect(getZones(true, d).map((z) => z.id)).not.toContain(first.id);
    expect(d.prepare("SELECT zone_name FROM orders").get()).toEqual({ zone_name: first.name });
    expect(deleteZone(first.id, d)).toMatchObject({ ok: false });
    // delete down to the last active area: refused
    const rest = getZones(true, d);
    for (const z of rest.slice(0, -1)) expect(deleteZone(z.id, d)).toMatchObject({ ok: true });
    const last = getZones(true, d)[0];
    expect(deleteZone(last.id, d)).toMatchObject({ ok: false });
    upsertZone({ id: 0, name: "New area", areas: "", feeMinor: 5000, eta: "", active: true, sort: 1 }, d);
    expect(deleteZone(last.id, d)).toMatchObject({ ok: true });
  });
});
