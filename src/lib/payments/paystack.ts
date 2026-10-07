import { createHmac, timingSafeEqual } from "node:crypto";
import { GatewayError, type FetchLike, type PaymentGateway } from "./types";

const BASE = "https://api.paystack.co";

export function paystackSignatureValid(rawBody: string, signature: string | null, secretKey: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const a = Buffer.from(signature.toLowerCase());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function makePaystack(cfg: { secretKey: string }, fetchImpl: FetchLike = fetch): PaymentGateway {
  const headers = { Authorization: `Bearer ${cfg.secretKey}`, "Content-Type": "application/json" };

  async function call(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: Record<string, any> }> {
    const res = await fetchImpl(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(15_000) });
    const json = (await res.json().catch(() => ({}))) as Record<string, any>;
    return { ok: res.ok, status: res.status, json };
  }

  return {
    id: "paystack",
    label: "Paystack",
    chargeCurrency: "GHS",
    verifyOnWebhook: false,

    async createCheckout(req) {
      const r = await call("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: req.email,
          amount: req.amountMinor,
          currency: req.currency,
          reference: req.attemptRef,
          callback_url: req.returnUrl,
          metadata: { order_number: req.orderNumber, customer_name: req.customerName, cancel_action: req.cancelUrl },
        }),
      });
      const url = r.json?.data?.authorization_url;
      if (!r.ok || r.json?.status !== true || typeof url !== "string") {
        throw new GatewayError(`Paystack could not start the payment (HTTP ${r.status}).`);
      }
      return { redirectUrl: url, providerRef: req.attemptRef };
    },

    async check(providerRef) {
      const r = await call(`/transaction/verify/${encodeURIComponent(providerRef)}`);
      const d = r.json?.data;
      if (!r.ok || !d) return { status: "pending", amountMinor: 0, currency: "", providerRef };
      const status = d.status === "success" ? "paid" : d.status === "failed" ? "failed" : "pending";
      return { status, amountMinor: Number(d.amount) || 0, currency: String(d.currency ?? "").toUpperCase(), providerRef };
    },

    async parseWebhook(rawBody, h) {
      if (!paystackSignatureValid(rawBody, h.get("x-paystack-signature"), cfg.secretKey)) return null;
      let evt: Record<string, any>;
      try {
        evt = JSON.parse(rawBody);
      } catch {
        return null;
      }
      const d = evt?.data ?? {};
      if (evt?.event === "charge.success" && typeof d.reference === "string") {
        return {
          kind: "paid",
          eventId: `charge.success:${d.id ?? d.reference}`,
          providerRef: d.reference,
          amountMinor: Number(d.amount) || 0,
          currency: String(d.currency ?? "").toUpperCase(),
        };
      }
      return { kind: "ignored" };
    },

    async ping() {
      const r = await call("/balance");
      if (r.status === 401) return { ok: false, message: "Paystack rejected the key (401). Check you copied the secret key." };
      if (!r.ok) return { ok: false, message: `Paystack answered HTTP ${r.status}.` };
      return { ok: true, message: "Connected to Paystack." };
    },
  };
}
