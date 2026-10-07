import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SCHEMA } from "./schema";
import { EBAY_SHOP, removeSampleData, seedIfEmpty } from "./seed";
import { openForTest, migrate } from "./db";
import { upsertShop } from "./admin";
import { listProducts, listShops } from "./catalog";
import { getShippingMethods, getZones } from "./settings";
import { createOrder } from "./orders";
import type { CartLine } from "./cart";
import { getProductById } from "./catalog";

const fresh = () => {
  const d = new Database(":memory:");
  d.pragma("foreign_keys = ON");
  d.exec(SCHEMA);
  migrate(d);
  return d;
};

describe("what a new database contains", () => {
  it("creates only the eBay UK shop, with settings, shipping and delivery areas, and no products", () => {
    const d = fresh();
    seedIfEmpty(d, { sample: false });
    const shops = listShops({ includeInactive: true }, d);
    expect(shops.map((s) => s.name)).toEqual([EBAY_SHOP.name]);
    expect(listProducts({}, d)).toEqual([]);
    expect(getShippingMethods(true, d).length).toBeGreaterThan(0);
    expect(getZones(true, d).length).toBeGreaterThan(0);
    expect(JSON.stringify(shops)).not.toMatch(/sample/i);
  });
});

describe("removing the made-up shops from an existing database", () => {
  const lineFor = (d: ReturnType<typeof openForTest>, productId: number): CartLine => {
    const p = getProductById(productId, d)!;
    return { itemId: 1, product: p, quantity: 1, options: Object.fromEntries(p.options.map((g) => [g.name, g.values[0]])) };
  };

  it("deletes sample shops and products, keeps your own shop and order history, and leaves eBay UK", () => {
    const d = openForTest(); // test fixtures: eight made-up shops with forty products
    const mine = upsertShop({ id: 0, name: "My Own Shop", tagline: "", category: "Fashion", websiteUrl: "", description: "A shop I made", accent: "#123456", active: true, sort: 99 }, d);
    d.prepare("INSERT INTO products (shop_id, slug, name, price_minor) VALUES (?, 'my-item', 'My Item', 1000)").run(mine);
    const sampleProduct = listProducts({}, d).find((p) => p.shopId !== mine)!;
    const zone = getZones(true, d)[0];
    const method = getShippingMethods(true, d)[0];
    const order = createOrder([lineFor(d, sampleProduct.id)], { customerName: "Ama", phone: "0241234567", email: "", zoneId: zone.id, address: "12 Example St", landmark: "", notes: "", shippingCode: method.code }, d);
    expect(order.ok).toBe(true);
    d.prepare("INSERT INTO carts (token) VALUES ('t')").run();
    d.prepare("INSERT INTO cart_items (cart_token, product_id, quantity) VALUES ('t', ?, 1)").run(sampleProduct.id);
    d.prepare("INSERT INTO catalog_sources (shop_id, name, kind) VALUES (?, 'Old demo feed', 'feed_csv')").run(sampleProduct.shopId);

    const r = removeSampleData(d);
    expect(r.shops).toBe(8);
    expect(r.products).toBe(40);
    expect(listShops({ includeInactive: true }, d).map((s) => s.name)).toEqual(["My Own Shop"]);
    expect(listProducts({}, d).map((p) => p.name)).toEqual(["My Item"]);
    expect(d.prepare("SELECT COUNT(*) AS n FROM cart_items").get()).toEqual({ n: 0 });
    expect(d.prepare("SELECT COUNT(*) AS n FROM catalog_sources").get()).toEqual({ n: 0 });
    expect(d.prepare("SELECT COUNT(*) AS n FROM order_items WHERE name = ?").get(sampleProduct.name)).toEqual({ n: 1 }); // the order still shows what was bought
    expect(removeSampleData(d)).toEqual({ shops: 0, products: 0 }); // once per database
  });

  it("creates eBay UK when nothing else is left", () => {
    const d = openForTest();
    removeSampleData(d);
    expect(listShops({ includeInactive: true }, d).map((s) => s.name)).toEqual([EBAY_SHOP.name]);
    expect(listProducts({}, d)).toEqual([]);
  });
});
