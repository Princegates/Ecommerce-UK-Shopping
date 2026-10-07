import { describe, expect, it, vi } from "vitest";
import { openForTest } from "../db";
import { getProductById, listProducts } from "../catalog";
import type { CartLine } from "../cart";
import { getIntegration, saveFields, setChannelProvider } from "../integrations";
import { createOrder, getOrderByRef, markPaid, staffSetStatus } from "../orders";
import { getShippingMethods, getZones } from "../settings";
import { DEFAULT_RULES, enqueueDirect, enqueueOrderEvent, getRules, maskRecipient, processOutbox, retryMessage, saveRules, sendTest } from "./outbox";
import { renderResetMessage } from "./templates";

const env = { NODE_ENV: "test", ADMIN_SECRET: "a-long-enough-admin-secret", APP_URL: "https://shop.example" } as unknown as NodeJS.ProcessEnv;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

function setup(opts: { sms?: boolean; email?: boolean; whatsapp?: boolean } = {}) {
  const d = openForTest();
  if (opts.sms) {
    saveFields(getIntegration("arkesel")!, { apiKey: "ark-key-1234567890", senderId: "AkwaabaUK" }, d, env);
    setChannelProvider("sms", "arkesel", d);
  }
  if (opts.email) {
    saveFields(getIntegration("resend")!, { apiKey: "re_abcdef123456", from: "Shop <orders@shop.example>" }, d, env);
    setChannelProvider("email", "resend", d);
  }
  if (opts.whatsapp) {
    saveFields(getIntegration("meta_whatsapp")!, { accessToken: "EAAG-token-1234567890", phoneNumberId: "1055", templateName: "order_update" }, d, env);
    setChannelProvider("whatsapp", "meta_whatsapp", d);
  }
  const product = listProducts({}, d)[0];
  const line: CartLine = { itemId: 1, product: getProductById(product.id, d)!, quantity: 1, options: {} };
  const make = (extra: Record<string, unknown> = {}) => {
    const res = createOrder([line], {
      customerName: "Ama Mensah", phone: "024 123 4567", email: "ama@example.com", zoneId: getZones(true, d)[0].id,
      address: "12 Example Street", landmark: "", notes: "", shippingCode: getShippingMethods(true, d)[0].code, ...extra,
    }, d);
    if (!res.ok) throw new Error(res.error);
    return getOrderByRef(res.paymentRef, d)!;
  };
  return { d, make };
}

const count = (d: ReturnType<typeof openForTest>, where = "1=1") => (d.prepare(`SELECT COUNT(*) AS n FROM messages WHERE ${where}`).get() as { n: number }).n;

describe("queueing order messages", () => {
  it("queues nothing when no provider is active", () => {
    const { d, make } = setup();
    const o = make();
    expect(enqueueOrderEvent(o.id, "PAID", d, env)).toBe(0);
  });

  it("queues SMS and email for a paid order, WhatsApp only with consent", () => {
    const { d, make } = setup({ sms: true, email: true, whatsapp: true });
    const noConsent = make();
    expect(enqueueOrderEvent(noConsent.id, "PAID", d, env)).toBe(2);
    expect(count(d, "channel = 'whatsapp'")).toBe(0);
    const consent = make({ notifyWhatsapp: true });
    expect(enqueueOrderEvent(consent.id, "PAID", d, env)).toBe(3);
    expect(count(d, `channel = 'whatsapp' AND order_id = ${consent.id}`)).toBe(1);
  });

  it("respects opt-outs, invalid addresses and the admin rules, and never queues twice", () => {
    const { d, make } = setup({ sms: true, email: true });
    const o = make({ notifySms: false, email: "not-an-email" });
    expect(enqueueOrderEvent(o.id, "PAID", d, env)).toBe(0);
    const p = make();
    expect(enqueueOrderEvent(p.id, "PURCHASING", d, env)).toBe(1); // email only by default
    expect(enqueueOrderEvent(p.id, "PURCHASING", d, env)).toBe(0); // duplicate
    const rules = getRules(d);
    rules.PURCHASED.sms = true;
    rules.PURCHASED.email = false;
    saveRules(rules, d);
    const q = make();
    expect(enqueueOrderEvent(q.id, "PURCHASED", d, env)).toBe(1);
    expect(count(d, `order_id = ${q.id} AND channel = 'sms'`)).toBe(1);
    expect(DEFAULT_RULES.AWAITING_PAYMENT.email).toBe(false);
  });

  it("queues from real order changes and links to the order page", () => {
    // the order hooks read the real process environment
    vi.stubEnv("ADMIN_SECRET", "a-long-enough-admin-secret");
    vi.stubEnv("APP_URL", "https://shop.example");
    const { d, make } = setup({ sms: true });
    const o = make();
    expect(markPaid(o.paymentRef, d)).toBe(true);
    const row = d.prepare("SELECT body, recipient, status FROM messages WHERE order_id = ?").get(o.id) as { body: string; recipient: string; status: string };
    expect(row.recipient).toBe("+233241234567");
    expect(row.body).toContain(`https://shop.example/order/${o.paymentRef}`);
    expect(row.status).toBe("PENDING");
    expect(staffSetStatus(o.id, "PURCHASING", "", d).ok).toBe(true);
    expect(count(d, `order_id = ${o.id}`)).toBe(1); // PURCHASING is email-only by default and email is off here
    vi.unstubAllEnvs();
  });
});

describe("sending", () => {
  it("sends through the chosen provider with the right request", async () => {
    const { d, make } = setup({ sms: true, email: true });
    enqueueOrderEvent(make().id, "PAID", d, env);
    const f = vi.fn(async (url: string) => (String(url).includes("arkesel") ? json({ status: "success" }) : json({ id: "em_1" })));
    const res = await processOutbox(d, env, f as never);
    expect(res).toEqual({ sent: 2, failed: 0, retrying: 0 });
    const sms = f.mock.calls.find((c) => String(c[0]).includes("arkesel"))!;
    const smsInit = (sms as unknown as [string, RequestInit])[1];
    expect((smsInit.headers as Record<string, string>)["api-key"]).toBe("ark-key-1234567890");
    expect(JSON.parse(String(smsInit.body))).toMatchObject({ sender: "AkwaabaUK", recipients: ["233241234567"] });
    const mail = f.mock.calls.find((c) => String(c[0]).includes("resend"))! as unknown as [string, RequestInit];
    expect(JSON.parse(String(mail[1].body))).toMatchObject({ from: "Shop <orders@shop.example>", to: ["ama@example.com"] });
    expect(count(d, "status = 'SENT'")).toBe(2);
  });

  it("retries a failing provider, then marks the message failed, and can retry on request", async () => {
    const { d, make } = setup({ sms: true });
    enqueueOrderEvent(make().id, "PAID", d, env);
    const f = vi.fn(async () => json({ status: "error", message: "bad sender" }, 400));
    expect(await processOutbox(d, env, f as never)).toEqual({ sent: 0, failed: 0, retrying: 1 });
    expect(await processOutbox(d, env, f as never)).toEqual({ sent: 0, failed: 0, retrying: 1 });
    expect(await processOutbox(d, env, f as never)).toEqual({ sent: 0, failed: 1, retrying: 0 });
    const row = d.prepare("SELECT id, status, attempts, error FROM messages").get() as { id: number; status: string; attempts: number; error: string };
    expect(row).toMatchObject({ status: "FAILED", attempts: 3 });
    expect(row.error).toContain("HTTP 400");
    expect(await processOutbox(d, env, f as never)).toEqual({ sent: 0, failed: 0, retrying: 0 });
    expect(retryMessage(row.id, d)).toBe(true);
    expect(await processOutbox(d, env, vi.fn(async () => json({ status: "success" })) as never)).toMatchObject({ sent: 1 });
  });

  it("does not send a message another run has claimed", async () => {
    const { d, make } = setup({ sms: true });
    enqueueOrderEvent(make().id, "PAID", d, env);
    d.prepare("UPDATE messages SET status = 'SENDING', locked_at = datetime('now')").run();
    const f = vi.fn(async () => json({ status: "success" }));
    expect(await processOutbox(d, env, f as never)).toEqual({ sent: 0, failed: 0, retrying: 0 });
    expect(f).not.toHaveBeenCalled();
    d.prepare("UPDATE messages SET locked_at = datetime('now', '-10 minutes')").run();
    expect(await processOutbox(d, env, f as never)).toMatchObject({ sent: 1 });
  });

  it("fails cleanly when the provider is switched off after queueing", async () => {
    const { d, make } = setup({ sms: true });
    enqueueOrderEvent(make().id, "PAID", d, env);
    setChannelProvider("sms", "", d);
    expect(await processOutbox(d, env, vi.fn() as never)).toMatchObject({ failed: 1 });
  });
});

describe("provider request shapes", () => {
  it("Twilio SMS uses a Messaging Service when the sender starts with MG", async () => {
    const { d } = setup();
    saveFields(getIntegration("twilio")!, { accountSid: "AC1", authToken: "tok-1234567890", smsFrom: "MG123", whatsappFrom: "+14155238886" }, d, env);
    const f = vi.fn(async () => json({ sid: "SM1" }, 201));
    expect(await sendTest("twilio", "sms", "024 123 4567", d, env, f as never)).toMatchObject({ ok: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("AC1:tok-1234567890").toString("base64")}`);
    const body = new URLSearchParams(String(init.body));
    expect(body.get("To")).toBe("+233241234567");
    expect(body.get("MessagingServiceSid")).toBe("MG123");
    expect(body.get("From")).toBeNull();
  });

  it("Twilio WhatsApp sends a content template when one is set, plain text otherwise", async () => {
    const { d } = setup();
    saveFields(getIntegration("twilio")!, { accountSid: "AC1", authToken: "tok-1234567890", whatsappFrom: "+14155238886" }, d, env);
    const plain = vi.fn(async () => json({ sid: "SM1" }, 201));
    await sendTest("twilio", "whatsapp", "0241234567", d, env, plain as never);
    const p = new URLSearchParams(String((plain.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(p.get("To")).toBe("whatsapp:+233241234567");
    expect(p.get("From")).toBe("whatsapp:+14155238886");
    expect(p.get("Body")).toBeTruthy();
    saveFields(getIntegration("twilio")!, { whatsappContentSid: "HX123" }, d, env);
    const tpl = vi.fn(async () => json({ sid: "SM2" }, 201));
    await sendTest("twilio", "whatsapp", "0241234567", d, env, tpl as never);
    const t = new URLSearchParams(String((tpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(t.get("ContentSid")).toBe("HX123");
    expect(JSON.parse(t.get("ContentVariables")!)).toHaveProperty("1", "Admin");
    expect(t.get("Body")).toBeNull();
  });

  it("Meta WhatsApp posts a template with three body parameters", async () => {
    const { d } = setup();
    saveFields(getIntegration("meta_whatsapp")!, { accessToken: "EAAG-token-1234567890", phoneNumberId: "1055", graphVersion: "v22.0" }, d, env);
    const f = vi.fn(async () => json({ messages: [{ id: "wamid.1" }] }));
    expect(await sendTest("meta_whatsapp", "whatsapp", "+44 7700 900123", d, env, f as never)).toMatchObject({ ok: true, id: "wamid.1" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v22.0/1055/messages");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ messaging_product: "whatsapp", to: "447700900123", type: "template", template: { name: "order_update", language: { code: "en" } } });
    expect(body.template.components[0].parameters).toHaveLength(3);
  });

  it("Postmark and Resend report their own failures", async () => {
    const { d } = setup();
    saveFields(getIntegration("postmark")!, { serverToken: "pm-token-1234567890", from: "orders@shop.example" }, d, env);
    expect(await sendTest("postmark", "email", "ama@example.com", d, env, vi.fn(async () => json({ ErrorCode: 0, MessageID: "m1" })) as never)).toMatchObject({ ok: true });
    const bad = await sendTest("postmark", "email", "ama@example.com", d, env, vi.fn(async () => json({ ErrorCode: 406, Message: "Inactive recipient" }, 422)) as never);
    expect(bad).toMatchObject({ ok: false });
    expect(JSON.stringify(bad)).not.toContain("pm-token");
  });

  it("test sends validate the recipient and need saved fields", async () => {
    const { d } = setup();
    expect(await sendTest("resend", "email", "ama@example.com", d, env, vi.fn() as never)).toMatchObject({ ok: false });
    saveFields(getIntegration("resend")!, { apiKey: "re_abcdef123456", from: "a@b.co" }, d, env);
    expect(await sendTest("resend", "email", "nope", d, env, vi.fn() as never)).toMatchObject({ ok: false });
    expect(await sendTest("resend", "sms", "0241234567", d, env, vi.fn() as never)).toMatchObject({ ok: false });
  });
});

describe("direct messages and masking", () => {
  it("queues a reset on the first channel that works", () => {
    const { d } = setup({ sms: true });
    const r = renderResetMessage("Shop", "https://shop.example/reset-password/t", 60);
    expect(enqueueDirect({ phone: "0241234567", email: "ama@example.com" }, r, "password_reset", d, env)).toBe("sms");
    const { d: d2 } = setup({ sms: true, email: true });
    expect(enqueueDirect({ phone: "0241234567", email: "ama@example.com" }, r, "password_reset", d2, env)).toBe("email");
    const { d: d3 } = setup();
    expect(enqueueDirect({ phone: "0241234567" }, r, "password_reset", d3, env)).toBeNull();
  });
  it("masks recipients for admins", () => {
    expect(maskRecipient("+233241234567")).toBe("+233••••567");
    expect(maskRecipient("ama@example.com")).toBe("a•••@example.com");
  });
});
