import Stripe from "stripe";
import { GatewayError, type Currency, type PaymentGateway } from "./types";

export function makeStripe(
  cfg: { secretKey: string; webhookSecret: string; chargeCurrency: Currency },
  client: Stripe = new Stripe(cfg.secretKey, { maxNetworkRetries: 1, timeout: 15_000 }),
): PaymentGateway {
  return {
    id: "stripe",
    label: "Stripe",
    chargeCurrency: cfg.chargeCurrency,
    verifyOnWebhook: false,

    async createCheckout(req) {
      try {
        const session = await client.checkout.sessions.create(
          {
            mode: "payment",
            client_reference_id: req.attemptRef,
            customer_email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.email) ? req.email : undefined,
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: req.currency.toLowerCase(),
                  unit_amount: req.amountMinor,
                  product_data: { name: `Order ${req.orderNumber}`, description: "Items, service charge, shipping and delivery" },
                },
              },
            ],
            success_url: req.returnUrl,
            cancel_url: req.cancelUrl,
            metadata: { attempt_ref: req.attemptRef, order_number: req.orderNumber },
          },
          { idempotencyKey: req.attemptRef },
        );
        if (!session.url) throw new GatewayError("Stripe did not return a payment page.");
        return { redirectUrl: session.url, providerRef: session.id };
      } catch (e) {
        if (e instanceof GatewayError) throw e;
        const msg = e instanceof Stripe.errors.StripeError ? `${e.type}${e.code ? ` (${e.code})` : ""}` : "unexpected error";
        throw new GatewayError(`Stripe could not start the payment: ${msg}.`);
      }
    },

    async check(providerRef) {
      const s = await client.checkout.sessions.retrieve(providerRef);
      const status = s.payment_status === "paid" ? "paid" : s.status === "expired" ? "failed" : "pending";
      return { status, amountMinor: s.amount_total ?? 0, currency: (s.currency ?? "").toUpperCase(), providerRef: s.id };
    },

    async parseWebhook(rawBody, h) {
      const sig = h.get("stripe-signature");
      if (!sig) return null;
      let event: Stripe.Event;
      try {
        event = client.webhooks.constructEvent(rawBody, sig, cfg.webhookSecret);
      } catch {
        return null;
      }
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          const s = event.data.object as Stripe.Checkout.Session;
          // "completed" can arrive before a delayed payment method has paid.
          if (s.payment_status !== "paid") return { kind: "ignored" };
          return { kind: "paid", eventId: event.id, providerRef: s.id, amountMinor: s.amount_total ?? 0, currency: (s.currency ?? "").toUpperCase() };
        }
        case "checkout.session.async_payment_failed":
        case "checkout.session.expired": {
          const s = event.data.object as Stripe.Checkout.Session;
          return { kind: "failed", eventId: event.id, providerRef: s.id };
        }
        default:
          return { kind: "ignored" };
      }
    },

    async ping() {
      try {
        await client.balance.retrieve();
        return { ok: true, message: "Connected to Stripe." };
      } catch (e) {
        if (e instanceof Stripe.errors.StripeAuthenticationError) return { ok: false, message: "Stripe rejected the key. Check you copied the secret key." };
        if (e instanceof Stripe.errors.StripePermissionError) return { ok: true, message: "Connected. This restricted key cannot read the balance, which is fine." };
        return { ok: false, message: "Could not reach Stripe." };
      }
    },
  };
}
