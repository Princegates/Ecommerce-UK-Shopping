export type Currency = "GHS" | "GBP";

export type CheckoutRequest = {
  attemptRef: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  email: string;
  amountMinor: number;
  currency: Currency;
  returnUrl: string;
  cancelUrl: string;
};

export type CheckoutResponse = { redirectUrl: string; providerRef: string };

export type PaymentCheck = {
  status: "paid" | "failed" | "pending";
  amountMinor: number;
  currency: string;
  providerRef: string;
};

export type WebhookOutcome =
  | { kind: "paid"; eventId: string; providerRef: string; amountMinor: number; currency: string }
  | { kind: "failed"; eventId: string; providerRef: string }
  | { kind: "ignored" };

export type PaymentGateway = {
  id: "stripe" | "paystack" | "flutterwave";
  label: string;
  /** Currency this gateway charges the customer in. */
  chargeCurrency: Currency;
  /** Re-check with the gateway before trusting a webhook (for gateways whose webhook is not signed per message). */
  verifyOnWebhook: boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResponse>;
  /** Ask the gateway for the current state of one payment. */
  check(providerRef: string): Promise<PaymentCheck>;
  /** Returns null when the signature is invalid. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookOutcome | null>;
  /** Cheap authenticated call to confirm the saved keys work. */
  ping(): Promise<{ ok: boolean; message: string }>;
};

export type FetchLike = typeof fetch;

/** A short, safe description of a failed gateway call. Never includes keys. */
export class GatewayError extends Error {}
