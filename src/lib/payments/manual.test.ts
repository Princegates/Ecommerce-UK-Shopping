import { describe, expect, it } from "vitest";
import { openForTest } from "../db";
import { createOrder, getOrderByRef, getOrderEvents, staffSetStatus } from "../orders";
import { getProductById, listProducts } from "../catalog";
import { getShippingMethods, getZones } from "../settings";
import type { CartLine } from "../cart";
import { applyOutcome, attemptsForOrder, createAttempt } from "./confirm";
import { confirmPaymentManually } from "./manual";

function setup() {
  const d = openForTest();
  const product = listProducts({}, d)[0];
  const line: CartLine = { itemId: 1, product: getProductById(product.id, d)!, quantity: 1, options: {} };
  const res = createOrder([line], {
    customerName: "Ama Mensah", phone: "0241234567", email: "", zoneId: getZones(true, d)[0].id,
    address: "12 Example Street", landmark: "", notes: "", shippingCode: getShippingMethods(true, d)[0].code,
  }, d);
  if (!res.ok) throw new Error(res.error);
  return { d, order: getOrderByRef(res.paymentRef, d)!, ref: res.paymentRef };
}

const input = { method: "bank_transfer", reference: "FT26123ABC", reason: "Customer paid by bank transfer; no gateway yet", by: "Kofi (manager)" };

describe("confirming a payment by hand", () => {
  it("marks the order paid, records how and by whom, and tells the customer only that payment arrived", () => {
    const { d, order, ref } = setup();
    const r = confirmPaymentManually(order.id, input, d);
    expect(r.ok).toBe(true);
    const after = getOrderByRef(ref, d)!;
    expect(after.status).toBe("PAID");
    expect(after.paymentStatus).toBe("PAID");
    const [attempt] = attemptsForOrder(order.id, d);
    expect(attempt).toMatchObject({ provider: "manual", status: "SUCCEEDED", currency: "GHS", amountMinor: order.totalMinor });
    expect(attempt.note).toContain("FT26123ABC");
    expect(attempt.note).toContain("Kofi (manager)");
    const paid = getOrderEvents(order.id, d).filter((e) => e.status === "PAID");
    expect(paid).toHaveLength(1);
    expect(paid[0].note).not.toContain("FT26123ABC");
    expect(paid[0].note).not.toContain("no gateway");
  });

  it("works only once and not on an order that is paid, cancelled or missing", () => {
    const { d, order } = setup();
    expect(confirmPaymentManually(order.id, input, d).ok).toBe(true);
    expect(confirmPaymentManually(order.id, { ...input, reference: "OTHER-REF-1" }, d)).toMatchObject({ ok: false });
    expect(getOrderEvents(order.id, d).filter((e) => e.status === "PAID")).toHaveLength(1);
    const c = setup();
    staffSetStatus(c.order.id, "CANCELLED", "", c.d);
    expect(confirmPaymentManually(c.order.id, input, c.d)).toMatchObject({ ok: false });
    expect(getOrderByRef(c.ref, c.d)?.paymentStatus).not.toBe("PAID");
    expect(confirmPaymentManually(999999, input, d)).toMatchObject({ ok: false, error: "Order not found." });
  });

  it("insists on a method, a reference and a real reason", () => {
    const { d, order, ref } = setup();
    expect(confirmPaymentManually(order.id, { ...input, method: "magic" }, d).ok).toBe(false);
    expect(confirmPaymentManually(order.id, { ...input, reference: " a " }, d).ok).toBe(false);
    expect(confirmPaymentManually(order.id, { ...input, reason: "ok" }, d).ok).toBe(false);
    expect(getOrderByRef(ref, d)?.status).toBe("AWAITING_PAYMENT");
    expect(attemptsForOrder(order.id, d)).toHaveLength(0);
  });

  it("will not reuse one reference to release two orders", () => {
    const { d, order } = setup();
    expect(confirmPaymentManually(order.id, input, d).ok).toBe(true);
    const second = createOrder([{ itemId: 1, product: getProductById(listProducts({}, d)[0].id, d)!, quantity: 1, options: {} }], {
      customerName: "Kojo", phone: "0241234568", email: "", zoneId: getZones(true, d)[0].id, address: "1 Road", landmark: "", notes: "",
      shippingCode: getShippingMethods(true, d)[0].code,
    }, d);
    if (!second.ok) throw new Error(second.error);
    const o2 = getOrderByRef(second.paymentRef, d)!;
    expect(confirmPaymentManually(o2.id, input, d)).toMatchObject({ ok: false });
    expect(getOrderByRef(second.paymentRef, d)?.status).toBe("AWAITING_PAYMENT");
    expect(confirmPaymentManually(o2.id, { ...input, reference: "FT26999XYZ" }, d).ok).toBe(true);
  });

  it("retires waiting gateway attempts, and a late gateway report cannot pay the order twice", () => {
    const { d, order } = setup();
    createAttempt({ orderId: order.id, provider: "paystack", providerRef: "att_1", attemptRef: "att_1", currency: "GHS", amountMinor: order.totalMinor }, d);
    expect(confirmPaymentManually(order.id, input, d).ok).toBe(true);
    expect(attemptsForOrder(order.id, d).find((a) => a.provider === "paystack")?.status).toBe("SUPERSEDED");
    applyOutcome("paystack", { kind: "paid", eventId: "evt_late", providerRef: "att_1", amountMinor: order.totalMinor, currency: "GHS" }, d);
    expect(getOrderEvents(order.id, d).filter((e) => e.status === "PAID" && /^Payment received/.test(e.note))).toHaveLength(1);
  });
});
