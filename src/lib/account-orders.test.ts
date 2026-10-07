import { describe, expect, it } from "vitest";
import { openForTest } from "./db";
import { getProductById, listProducts } from "./catalog";
import type { CartLine } from "./cart";
import { markUpdatesSeen, registerCustomer, unseenUpdateCount, updatesFeed } from "./customers";
import {
  addTracking, createOrder, getOrderForCustomer, getTracking, listOrdersForCustomer, reorderableItems, staffSetStatus, markPaid, deleteTracking,
} from "./orders";
import { getShippingMethods, getZones } from "./settings";
import { listWishlist, toggleWishlist, wishlistIds } from "./wishlist";

async function setup() {
  const d = openForTest();
  const a = await registerCustomer({ name: "Ama Mensah", phone: "0241234567", email: "", password: "river-lamp-orange-42" }, d);
  const b = await registerCustomer({ name: "Kofi Boateng", phone: "0551112222", email: "", password: "green-door-lantern-9" }, d);
  if (!a.ok || !b.ok) throw new Error("setup");
  const products = listProducts({}, d);
  const lineFor = (p = products[0], qty = 1): CartLine => ({ itemId: p.id, product: getProductById(p.id, d)!, quantity: qty, options: p.options.length ? Object.fromEntries(p.options.map((g) => [g.name, g.values[0]])) : {} });
  const order = (customerId: number | null, p = products[0]) => {
    const r = createOrder([lineFor(p)], {
      customerName: "Ama Mensah", phone: "0241234567", email: "", zoneId: getZones(true, d)[0].id, address: "12 Example Street",
      landmark: "", notes: "", shippingCode: getShippingMethods(true, d)[0].code, customerId,
    }, d);
    if (!r.ok) throw new Error(r.error);
    return r;
  };
  return { d, ama: a.customer, kofi: b.customer, order, products };
}

describe("orders in an account", () => {
  it("lists only the customer's own orders and scopes lookups", async () => {
    const { d, ama, kofi, order } = await setup();
    const mine = order(ama.id);
    order(kofi.id);
    order(null);
    const list = listOrdersForCustomer(ama.id, d);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ number: mine.number, itemCount: 1 });
    expect(getOrderForCustomer(ama.id, mine.number, d)?.number).toBe(mine.number);
    expect(getOrderForCustomer(kofi.id, mine.number, d)).toBeNull();
  });
  it("only lets a customer re-order their own order", async () => {
    const { d, ama, kofi, order, products } = await setup();
    const mine = order(ama.id, products[0]);
    expect(reorderableItems(ama.id, mine.number, d)).toEqual([expect.objectContaining({ productId: products[0].id, quantity: 1 })]);
    expect(reorderableItems(kofi.id, mine.number, d)).toEqual([]);
    d.prepare("UPDATE products SET active = 0 WHERE id = ?").run(products[0].id);
    expect(reorderableItems(ama.id, mine.number, d)).toHaveLength(1); // still listed; the cart rejects unavailable products
  });
});

describe("tracking numbers", () => {
  it("records tracking, shows it in order and adds an update", async () => {
    const { d, ama, order } = await setup();
    const o = order(ama.id);
    const row = d.prepare("SELECT id FROM orders WHERE number = ?").get(o.number) as { id: number };
    expect(addTracking(row.id, { stage: "RETAILER", carrier: "Royal Mail", reference: "AB123456789GB", url: "https://track.example/AB123", note: "" }, d).ok).toBe(true);
    const t = getTracking(row.id, d);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ stage: "RETAILER", carrier: "Royal Mail", reference: "AB123456789GB" });
    expect(updatesFeed(ama.id, 10, d)[0].note).toContain("Royal Mail");
    deleteTracking(row.id, t[0].id, d);
    expect(getTracking(row.id, d)).toHaveLength(0);
  });
  it("rejects bad input and unsafe links", async () => {
    const { d, ama, order } = await setup();
    const o = order(ama.id);
    const row = d.prepare("SELECT id FROM orders WHERE number = ?").get(o.number) as { id: number };
    expect(addTracking(row.id, { stage: "NOPE", carrier: "", reference: "x", url: "", note: "" }, d).ok).toBe(false);
    expect(addTracking(row.id, { stage: "COURIER", carrier: "", reference: "", url: "", note: "" }, d).ok).toBe(false);
    expect(addTracking(row.id, { stage: "COURIER", carrier: "X", reference: "1", url: "javascript:alert(1)", note: "" }, d).ok).toBe(false);
    expect(addTracking(9999, { stage: "COURIER", carrier: "X", reference: "1", url: "", note: "" }, d).ok).toBe(false);
  });
});

describe("updates feed", () => {
  it("counts new updates and clears them when seen", async () => {
    const { d, ama, kofi, order } = await setup();
    const o = order(ama.id);
    order(kofi.id);
    expect(unseenUpdateCount(ama.id, d)).toBe(0); // placing the order is not news
    markPaid(o.paymentRef, d);
    const id = (d.prepare("SELECT id FROM orders WHERE number = ?").get(o.number) as { id: number }).id;
    d.prepare("UPDATE order_events SET created_at = datetime('now', '+1 minute') WHERE status = 'PAID'").run();
    expect(unseenUpdateCount(ama.id, d)).toBe(1);
    expect(unseenUpdateCount(kofi.id, d)).toBe(0);
    staffSetStatus(id, "PURCHASING", "buying", d);
    markUpdatesSeen(ama.id, d);
    d.prepare("UPDATE customers SET updates_seen_at = datetime('now', '+1 hour') WHERE id = ?").run(ama.id);
    expect(unseenUpdateCount(ama.id, d)).toBe(0);
    expect(updatesFeed(ama.id, 10, d).some((u) => u.orderNumber === o.number)).toBe(true);
    expect(updatesFeed(kofi.id, 10, d).every((u) => u.orderNumber !== o.number)).toBe(true);
  });
});

describe("wishlist", () => {
  it("toggles items per customer and ignores hidden products", async () => {
    const { d, ama, kofi, products } = await setup();
    expect(toggleWishlist(ama.id, products[0].id, d)).toBe(true);
    expect(toggleWishlist(ama.id, products[1].id, d)).toBe(true);
    expect([...wishlistIds(ama.id, d)].sort()).toEqual([products[0].id, products[1].id].sort());
    expect(wishlistIds(kofi.id, d).size).toBe(0);
    expect(wishlistIds(null, d).size).toBe(0);
    expect(toggleWishlist(ama.id, products[0].id, d)).toBe(false);
    expect(listWishlist(ama.id, d).map((p) => p.id)).toEqual([products[1].id]);
    expect(toggleWishlist(ama.id, 999999, d)).toBe(false);
    d.prepare("UPDATE products SET active = 0 WHERE id = ?").run(products[1].id);
    expect(listWishlist(ama.id, d)).toHaveLength(0);
  });
});
