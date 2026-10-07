import { timingSafeEqual } from "node:crypto";
import { GatewayError, type FetchLike, type PaymentGateway } from "./types";
import type { Json } from "@/lib/json";

const BASE = "https://api.flutterwave.com/v3";

export function flutterwaveHashValid(header: string | null, secretHash: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secretHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function makeFlutterwave(
  cfg: { secretKey: string; secretHash: string; title?: string },
  fetchImpl: FetchLike = fetch,
): PaymentGateway {
  const auth = { Authorization: `Bearer ${cfg.secretKey}`, "Content-Type": "application/json" };

  async function call(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: Json }> {
    const res = await fetchImpl(`${BASE}${path}`, { ...init, headers: { ...auth, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(15_000) });
    const json = (await res.json().catch(() => ({}))) as Json;
    return { ok: res.ok, status: res.status, json };
  }

  return {
    id: "flutterwave",
    label: "Flutterwave",
    chargeCurrency: "GHS",
    // The webhook is authenticated by a shared hash rather than a per-message signature,
    // so the payment is always re-checked with Flutterwave before it is accepted.
    verifyOnWebhook: true,

    async createCheckout(req) {
      const r = await call("/payments", {
        method: "POST",
        body: JSON.stringify({
          tx_ref: req.attemptRef,
          amount: Number((req.amountMinor / 100).toFixed(2)),
          currency: req.currency,
          redirect_url: req.returnUrl,
          customer: { email: req.email, phonenumber: req.phone, name: req.customerName },
          customizations: { title: cfg.title ?? "Order payment", description: `Order ${req.orderNumber}` },
          meta: { order_number: req.orderNumber },
        }),
      });
      const link = r.json?.data?.link;
      if (!r.ok || r.json?.status !== "success" || typeof link !== "string") {
        throw new GatewayError(`Flutterwave could not start the payment (HTTP ${r.status}).`);
      }
      return { redirectUrl: link, providerRef: req.attemptRef };
    },

    async check(providerRef) {
      const r = await call(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(providerRef)}`);
      const d = r.json?.data;
      if (!r.ok || r.json?.status !== "success" || !d) return { status: "pending", amountMinor: 0, currency: "", providerRef };
      const status = d.status === "successful" ? "paid" : d.status === "failed" ? "failed" : "pending";
      return {
        status,
        amountMinor: Math.round(Number(d.amount) * 100) || 0,
        currency: String(d.currency ?? "").toUpperCase(),
        providerRef,
      };
    },

    async parseWebhook(rawBody, h) {
      if (!flutterwaveHashValid(h.get("verif-hash"), cfg.secretHash)) return null;
      let evt: Json;
      try {
        evt = JSON.parse(rawBody);
      } catch {
        return null;
      }
      const d = evt?.data ?? {};
      if (typeof d.tx_ref !== "string") return { kind: "ignored" };
      const eventId = `${evt?.event ?? "event"}:${d.id ?? d.tx_ref}`;
      if (d.status === "successful") {
        return { kind: "paid", eventId, providerRef: d.tx_ref, amountMinor: Math.round(Number(d.amount) * 100) || 0, currency: String(d.currency ?? "").toUpperCase() };
      }
      if (d.status === "failed") return { kind: "failed", eventId, providerRef: d.tx_ref };
      return { kind: "ignored" };
    },

    async ping() {
      const r = await call("/banks/GH");
      if (r.status === 401 || r.status === 403) return { ok: false, message: `Flutterwave rejected the key (HTTP ${r.status}).` };
      if (!r.ok) return { ok: false, message: `Flutterwave answered HTTP ${r.status}.` };
      return { ok: true, message: "Connected to Flutterwave." };
    },
  };
}
