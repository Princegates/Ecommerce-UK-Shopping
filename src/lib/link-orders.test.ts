import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate, openForTest } from "./db";
import { getLinkRequest, getLinkRequestByToken, listRequestsForCustomer, placeLinkOrder, quotedLine, quoteRequest, quoteState } from "./link-orders";
import { renderQuoteMessage } from "./notify/templates";
import { getOrderById, getOrderItems, getOrderByRef, markPaid, quoteCart } from "./orders";
import { SCHEMA } from "./schema";
import { getShippingMethods, getZones } from "./settings";

const NOW = Date.parse("2026-10-07T12:00:00Z");

function setup() {
  const d = openForTest();
  d.prepare("INSERT INTO customers (id, name, phone, email, password_hash) VALUES (5, 'Ama Mensah', '0241234567', 'ama@example.com', 'x')").run();
  const id = Number(
    d.prepare("INSERT INTO link_requests (url, title, details, quantity, price_seen, name, phone, email, customer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("https://www.argos.co.uk/product/123", "Tefal Kettle", "white", 2, "24.99", "Ama Mensah", "0241234567", "ama@example.com", 5).lastInsertRowid,
  );
  const details = () => ({
    customerName: "Ama Mensah", phone: "0241234567", email: "", zoneId: getZones(true, d)[0].id, address: "12 Example Street", landmark: "", notes: "",
    shippingCode: getShippingMethods(true, d)[0].code, customerId: 5,
  });
  return { d, id, details };
}

describe("quoting a link request", () => {
  it("validates the quote, opens a private link and can be redone", () => {
    const { d, id } = setup();
    expect(quoteState(getLinkRequest(id, d)!, NOW)).toBe("waiting");
    expect(quoteRequest(id, { unitPriceMinor: 10, weightGrams: 500, validDays: 3, note: "" }, d, NOW)).toMatchObject({ ok: false });
    expect(quoteRequest(id, { unitPriceMinor: 2499, weightGrams: 0, validDays: 3, note: "" }, d, NOW)).toMatchObject({ ok: false });
    expect(quoteRequest(999, { unitPriceMinor: 2499, weightGrams: 500, validDays: 3, note: "" }, d, NOW)).toMatchObject({ ok: false });
    const q = quoteRequest(id, { unitPriceMinor: 2499, weightGrams: 1200, validDays: 3, note: "In stock" }, d, NOW);
    expect(q.ok && q.token).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    const r = getLinkRequest(id, d)!;
    expect(r).toMatchObject({ status: "QUOTED", quotePriceMinor: 2499, quoteWeightGrams: 1200, quoteNote: "In stock" });
    expect(quoteState(r, NOW)).toBe("open");
    expect(quoteState(r, NOW + 4 * 86_400_000)).toBe("expired");
    const again = quoteRequest(id, { unitPriceMinor: 2599, weightGrams: 1200, validDays: 5, note: "" }, d, NOW);
    expect(again.ok && q.ok && again.token === q.token).toBe(true); // the customer's link keeps working
    expect(getLinkRequestByToken(q.ok ? q.token : "", d)?.quotePriceMinor).toBe(2599);
    expect(getLinkRequestByToken("nope", d)).toBeNull();
  });
});

describe("paying for a quoted request", () => {
  it("creates a normal order priced exactly like checkout, linked back to the request", () => {
    const { d, id, details } = setup();
    const q = quoteRequest(id, { unitPriceMinor: 2499, weightGrams: 1200, validDays: 3, note: "" }, d, NOW);
    if (!q.ok) throw new Error(q.error);
    const placed = placeLinkOrder(q.token, details(), d, NOW);
    expect(placed).toMatchObject({ ok: true, existing: false });
    if (!placed.ok) return;
    const order = getOrderByRef(placed.paymentRef, d)!;
    const expected = quoteCart([quotedLine(getLinkRequest(id, d)!)], details().zoneId, details().shippingCode, d);
    expect(expected.ok && order.totalMinor === expected.breakdown.totalMinor).toBe(true);
    expect(order.status).toBe("AWAITING_PAYMENT");
    expect(d.prepare("SELECT customer_id FROM orders WHERE id = ?").get(order.id)).toEqual({ customer_id: 5 }); // shows in the customer's account
    const items = getOrderItems(order.id, d);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: "Tefal Kettle", quantity: 2, unitPriceMinor: 2499, shopName: "argos.co.uk", sourceUrl: "https://www.argos.co.uk/product/123" });
    expect(d.prepare("SELECT product_id FROM order_items WHERE order_id = ?").get(order.id)).toEqual({ product_id: null });
    expect(getLinkRequest(id, d)).toMatchObject({ status: "ORDERED", orderId: order.id });

    // it is a normal order from here on
    expect(markPaid(placed.paymentRef, d)).toBe(true);
    expect(getOrderById(order.id, d)?.status).toBe("PAID");
  });

  it("returns the same order if the customer submits twice", () => {
    const { d, id, details } = setup();
    const q = quoteRequest(id, { unitPriceMinor: 2499, weightGrams: 1200, validDays: 3, note: "" }, d, NOW);
    if (!q.ok) throw new Error(q.error);
    const a = placeLinkOrder(q.token, details(), d, NOW);
    const b = placeLinkOrder(q.token, details(), d, NOW);
    expect(a.ok && b.ok && a.paymentRef === b.paymentRef && b.existing).toBe(true);
    expect((d.prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number }).n).toBe(1);
    expect(quoteRequest(id, { unitPriceMinor: 100, weightGrams: 500, validDays: 3, note: "" }, d, NOW)).toMatchObject({ ok: false });
  });

  it("refuses expired, rejected, unquoted and unknown links", () => {
    const { d, id, details } = setup();
    expect(placeLinkOrder("x".repeat(30), details(), d, NOW)).toMatchObject({ ok: false });
    const q = quoteRequest(id, { unitPriceMinor: 2499, weightGrams: 1200, validDays: 1, note: "" }, d, NOW);
    if (!q.ok) throw new Error(q.error);
    expect(placeLinkOrder(q.token, details(), d, NOW + 3 * 86_400_000)).toMatchObject({ ok: false, error: expect.stringContaining("expired") });
    d.prepare("UPDATE link_requests SET status = 'REJECTED' WHERE id = ?").run(id);
    expect(placeLinkOrder(q.token, details(), d, NOW)).toMatchObject({ ok: false });
    expect((d.prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number }).n).toBe(0);
  });

  it("applies the minimum order like checkout", () => {
    const { d, id, details } = setup();
    d.prepare("UPDATE link_requests SET quantity = 1 WHERE id = ?").run(id);
    const q = quoteRequest(id, { unitPriceMinor: 500, weightGrams: 300, validDays: 3, note: "" }, d, NOW);
    if (!q.ok) throw new Error(q.error);
    expect(placeLinkOrder(q.token, details(), d, NOW)).toMatchObject({ ok: false, error: expect.stringContaining("minimum order") });
    expect(getLinkRequest(id, d)?.status).toBe("QUOTED");
  });
});

describe("customer view and messages", () => {
  it("lists a customer's own requests, including guest ones made with their phone number", () => {
    const { d } = setup();
    d.prepare("INSERT INTO link_requests (url, name, phone) VALUES ('https://shop.example/a', 'Ama', '+233 24 123 4567')").run();
    d.prepare("INSERT INTO link_requests (url, name, phone) VALUES ('https://shop.example/b', 'Other', '0200000000')").run();
    const mine = listRequestsForCustomer(5, "0241234567", d);
    expect(mine.map((r) => r.url).sort()).toEqual(["https://shop.example/a", "https://www.argos.co.uk/product/123"]);
  });

  it("writes a short quote message with the pay link", () => {
    const m = renderQuoteMessage("SHOP UK FROM GH", "Ama Mensah", "Tefal Kettle", "https://shop.example/quote/tok", 3);
    expect(m.sms).toContain("https://shop.example/quote/tok");
    expect(m.sms.length).toBeLessThan(220);
    expect(m.email.html).toContain("See your price and pay");
    expect(renderQuoteMessage("S", "A", "<script>", "https://x/q", 3).email.html).not.toContain("<script>");
  });

  it("adds the quote columns to an existing database", () => {
    const d = new Database(":memory:");
    d.exec(SCHEMA.replace(/,\n  -- Filled in when[\s\S]*?order_id          INTEGER\n\)/, "\n)"));
    const cols = () => (d.prepare("PRAGMA table_info(link_requests)").all() as { name: string }[]).map((c) => c.name);
    expect(cols()).not.toContain("token");
    migrate(d);
    expect(cols()).toEqual(expect.arrayContaining(["token", "quote_price_minor", "order_id"]));
  });
});
