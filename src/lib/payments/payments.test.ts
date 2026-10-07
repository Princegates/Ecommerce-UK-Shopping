import { createHmac } from "node:crypto";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { openForTest } from "../db";
import { createOrder, getOrderByRef, getOrderEvents, staffSetStatus } from "../orders";
import { getProductById, listProducts } from "../catalog";
import { getShippingMethods, getZones } from "../settings";
import type { CartLine } from "../cart";
import { applyOutcome, confirmPaid, createAttempt, failAttempt } from "./confirm";
import { flutterwaveHashValid, makeFlutterwave } from "./flutterwave";
import { makePaystack, paystackSignatureValid } from "./paystack";
import { makeStripe } from "./stripe";

const req = {
  attemptRef: "att_123", orderNumber: "UKG-2026-000001", customerName: "Ama Mensah", phone: "0241234567",
  email: "ama@example.com", amountMinor: 241847, currency: "GHS" as const,
  returnUrl: "https://shop.example/pay/x/return", cancelUrl: "https://shop.example/pay/x",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("paystack", () => {
  const secret = "sk_test_secret";
  it("verifies the HMAC-SHA512 signature of the raw body", () => {
    const body = JSON.stringify({ event: "charge.success" });
    const sig = createHmac("sha512", secret).update(body).digest("hex");
    expect(paystackSignatureValid(body, sig, secret)).toBe(true);
    expect(paystackSignatureValid(body + " ", sig, secret)).toBe(false);
    expect(paystackSignatureValid(body, null, secret)).toBe(false);
    expect(paystackSignatureValid(body, sig, "sk_test_other")).toBe(false);
  });
  it("initialises a transaction in pesewas with our reference", async () => {
    const f = vi.fn().mockResolvedValue(json({ status: true, data: { authorization_url: "https://checkout.paystack.com/abc" } }));
    const g = makePaystack({ secretKey: secret }, f as never);
    const out = await g.createCheckout(req);
    expect(out).toEqual({ redirectUrl: "https://checkout.paystack.com/abc", providerRef: "att_123" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.paystack.co/transaction/initialize");
    expect(init.headers.Authorization).toBe(`Bearer ${secret}`);
    expect(JSON.parse(init.body)).toMatchObject({ amount: 241847, currency: "GHS", reference: "att_123", email: "ama@example.com", callback_url: req.returnUrl });
  });
  it("surfaces a failed initialise without leaking the key", async () => {
    const g = makePaystack({ secretKey: secret }, vi.fn().mockResolvedValue(json({ status: false, message: "bad" }, 400)) as never);
    await expect(g.createCheckout(req)).rejects.toThrow(/HTTP 400/);
    await expect(g.createCheckout(req)).rejects.not.toThrow(secret);
  });
  it("maps verify results", async () => {
    const mk = (status: string) => makePaystack({ secretKey: secret }, vi.fn().mockResolvedValue(json({ status: true, data: { status, amount: 100, currency: "ghs" } })) as never);
    expect(await mk("success").check("r")).toMatchObject({ status: "paid", amountMinor: 100, currency: "GHS" });
    expect((await mk("failed").check("r")).status).toBe("failed");
    expect((await mk("abandoned").check("r")).status).toBe("pending");
  });
  it("parses only signed charge.success webhooks", async () => {
    const body = JSON.stringify({ event: "charge.success", data: { id: 77, reference: "att_123", amount: 241847, currency: "GHS" } });
    const sig = createHmac("sha512", secret).update(body).digest("hex");
    const g = makePaystack({ secretKey: secret });
    expect(await g.parseWebhook(body, new Headers({ "x-paystack-signature": sig }))).toEqual({ kind: "paid", eventId: "charge.success:77", providerRef: "att_123", amountMinor: 241847, currency: "GHS" });
    expect(await g.parseWebhook(body, new Headers({ "x-paystack-signature": "bad" }))).toBeNull();
    const other = JSON.stringify({ event: "transfer.success", data: {} });
    expect(await g.parseWebhook(other, new Headers({ "x-paystack-signature": createHmac("sha512", secret).update(other).digest("hex") }))).toEqual({ kind: "ignored" });
  });
});

describe("flutterwave", () => {
  const cfg = { secretKey: "FLWSECK_TEST-abc", secretHash: "my-secret-hash" };
  it("compares the verif-hash header", () => {
    expect(flutterwaveHashValid("my-secret-hash", cfg.secretHash)).toBe(true);
    expect(flutterwaveHashValid("nope", cfg.secretHash)).toBe(false);
    expect(flutterwaveHashValid(null, cfg.secretHash)).toBe(false);
  });
  it("creates a payment in major units and asks for re-verification of webhooks", async () => {
    const f = vi.fn().mockResolvedValue(json({ status: "success", data: { link: "https://checkout.flutterwave.com/v3/hosted/pay/x" } }));
    const g = makeFlutterwave(cfg, f as never);
    expect(g.verifyOnWebhook).toBe(true);
    const out = await g.createCheckout(req);
    expect(out.redirectUrl).toContain("flutterwave.com");
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body).toMatchObject({ tx_ref: "att_123", amount: 2418.47, currency: "GHS", redirect_url: req.returnUrl });
    expect(body.customer).toMatchObject({ email: "ama@example.com", phonenumber: "0241234567" });
  });
  it("maps verify_by_reference and webhook payloads", async () => {
    const g = makeFlutterwave(cfg, vi.fn().mockResolvedValue(json({ status: "success", data: { status: "successful", amount: 2418.47, currency: "GHS" } })) as never);
    expect(await g.check("att_123")).toMatchObject({ status: "paid", amountMinor: 241847, currency: "GHS" });
    const body = JSON.stringify({ event: "charge.completed", data: { id: 9, tx_ref: "att_123", status: "successful", amount: 2418.47, currency: "GHS" } });
    expect(await g.parseWebhook(body, new Headers({ "verif-hash": cfg.secretHash }))).toMatchObject({ kind: "paid", providerRef: "att_123", amountMinor: 241847 });
    expect(await g.parseWebhook(body, new Headers({ "verif-hash": "wrong" }))).toBeNull();
  });
});

describe("stripe", () => {
  const whsec = "whsec_testsecret";
  const client = new Stripe("sk_test_dummy");
  const sign = (payload: string) => client.webhooks.generateTestHeaderString({ payload, secret: whsec });
  const event = (type: string, object: Record<string, unknown>) => JSON.stringify({ id: "evt_1", object: "event", type, data: { object }, api_version: null, created: 1, livemode: false, pending_webhooks: 0, request: null });

  it("creates a Checkout Session with our reference, amount and an idempotency key", async () => {
    const create = vi.fn().mockResolvedValue({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    const g = makeStripe({ secretKey: "sk_test_dummy", webhookSecret: whsec, chargeCurrency: "GBP" }, { checkout: { sessions: { create } } } as never);
    const out = await g.createCheckout({ ...req, currency: "GBP", amountMinor: 15862 });
    expect(out).toEqual({ redirectUrl: "https://checkout.stripe.com/c/pay/cs_test_1", providerRef: "cs_test_1" });
    const [params, opts] = create.mock.calls[0];
    expect(params).toMatchObject({ mode: "payment", client_reference_id: "att_123", success_url: req.returnUrl, cancel_url: req.cancelUrl });
    expect(params.line_items[0].price_data).toMatchObject({ currency: "gbp", unit_amount: 15862 });
    expect(opts).toEqual({ idempotencyKey: "att_123" });
  });
  it("verifies the webhook signature and reads a paid session", async () => {
    const g = makeStripe({ secretKey: "sk_test_dummy", webhookSecret: whsec, chargeCurrency: "GBP" }, client);
    const payload = event("checkout.session.completed", { id: "cs_test_1", object: "checkout.session", payment_status: "paid", amount_total: 15862, currency: "gbp" });
    expect(await g.parseWebhook(payload, new Headers({ "stripe-signature": sign(payload) }))).toEqual({ kind: "paid", eventId: "evt_1", providerRef: "cs_test_1", amountMinor: 15862, currency: "GBP" });
    expect(await g.parseWebhook(payload, new Headers({ "stripe-signature": "t=1,v1=bad" }))).toBeNull();
    expect(await g.parseWebhook(payload, new Headers())).toBeNull();
    const unpaid = event("checkout.session.completed", { id: "cs_test_2", object: "checkout.session", payment_status: "unpaid", amount_total: 1, currency: "gbp" });
    expect(await g.parseWebhook(unpaid, new Headers({ "stripe-signature": sign(unpaid) }))).toEqual({ kind: "ignored" });
    const expired = event("checkout.session.expired", { id: "cs_test_3", object: "checkout.session" });
    expect(await g.parseWebhook(expired, new Headers({ "stripe-signature": sign(expired) }))).toMatchObject({ kind: "failed", providerRef: "cs_test_3" });
  });
});

function paidSetup() {
  const d = openForTest();
  const product = listProducts({}, d)[0];
  const line: CartLine = { itemId: 1, product: getProductById(product.id, d)!, quantity: 1, options: {} };
  const res = createOrder([line], {
    customerName: "Ama Mensah", phone: "0241234567", email: "", zoneId: getZones(true, d)[0].id,
    address: "12 Example Street", landmark: "", notes: "", shippingCode: getShippingMethods(true, d)[0].code,
  }, d);
  if (!res.ok) throw new Error(res.error);
  const order = getOrderByRef(res.paymentRef, d)!;
  createAttempt({ orderId: order.id, provider: "paystack", providerRef: "att_1", attemptRef: "att_1", currency: "GHS", amountMinor: order.totalMinor }, d);
  return { d, order, ref: res.paymentRef };
}

describe("confirming payments", () => {
  it("marks the order paid when amount and currency match, once", () => {
    const { d, order, ref } = paidSetup();
    expect(confirmPaid("paystack", "att_1", order.totalMinor, "ghs", d)).toBe("confirmed");
    expect(getOrderByRef(ref, d)?.status).toBe("PAID");
    expect(confirmPaid("paystack", "att_1", order.totalMinor, "GHS", d)).toBe("already");
    expect(getOrderEvents(order.id, d).filter((e) => e.status === "PAID")).toHaveLength(1);
  });
  it("refuses a wrong amount or currency and flags it for review", () => {
    const { d, order, ref } = paidSetup();
    expect(confirmPaid("paystack", "att_1", order.totalMinor - 1, "GHS", d)).toBe("mismatch");
    expect(getOrderByRef(ref, d)?.status).toBe("AWAITING_PAYMENT");
    expect(getOrderEvents(order.id, d).some((e) => /needs review/.test(e.note))).toBe(true);
    const second = paidSetup();
    expect(confirmPaid("paystack", "att_1", second.order.totalMinor, "GBP", second.d)).toBe("mismatch");
  });
  it("ignores unknown references", () => {
    const { d, order } = paidSetup();
    expect(confirmPaid("paystack", "att_unknown", order.totalMinor, "GHS", d)).toBe("unknown");
    expect(confirmPaid("stripe", "att_1", order.totalMinor, "GHS", d)).toBe("unknown");
  });
  it("applies a webhook event once and ignores replays", () => {
    const { d, order, ref } = paidSetup();
    const outcome = { kind: "paid" as const, eventId: "evt_a", providerRef: "att_1", amountMinor: order.totalMinor, currency: "GHS" };
    expect(applyOutcome("paystack", outcome, d)).toBe("confirmed");
    expect(applyOutcome("paystack", outcome, d)).toBe("duplicate");
    expect(getOrderByRef(ref, d)?.paymentStatus).toBe("PAID");
    expect(applyOutcome("paystack", { kind: "ignored" }, d)).toBe("ignored");
  });
  it("records a failed attempt and lets another attempt succeed", () => {
    const { d, order, ref } = paidSetup();
    expect(failAttempt("paystack", "att_1", "declined", d)).toBe(true);
    createAttempt({ orderId: order.id, provider: "stripe", providerRef: "cs_2", attemptRef: "att_2", currency: "GBP", amountMinor: 15000 }, d);
    expect(confirmPaid("stripe", "cs_2", 15000, "GBP", d)).toBe("confirmed");
    expect(getOrderByRef(ref, d)?.status).toBe("PAID");
  });
  it("flags a payment that arrives after the order was cancelled", () => {
    const { d, order, ref } = paidSetup();
    expect(staffSetStatus(order.id, "CANCELLED", "", d).ok).toBe(true);
    expect(confirmPaid("paystack", "att_1", order.totalMinor, "GHS", d)).toBe("confirmed");
    expect(getOrderByRef(ref, d)?.status).toBe("CANCELLED");
    expect(getOrderEvents(order.id, d).some((e) => /refund is needed/.test(e.note))).toBe(true);
  });
});
