import type Database from "better-sqlite3";
import { db } from "./db";
import { decrypt, encrypt, encryptionPassphrase } from "./secrets";
import { getSetting, setSetting } from "./settings";

type Db = Database.Database;

export type Channel = "payments" | "sms" | "whatsapp" | "email" | "rates" | "catalog";
export type ProviderId =
  | "stripe" | "paystack" | "flutterwave"
  | "arkesel" | "twilio" | "meta_whatsapp"
  | "resend" | "postmark"
  | "exchangerate_api" | "openexchangerates"
  | "ebay" | "diffbot";

export type FieldDef = {
  key: string;
  label: string;
  /** Environment variable that overrides anything saved in the admin. */
  env: string;
  secret?: boolean;
  /** Channels for which this field must be filled before the provider can be used. */
  required?: Channel[];
  help?: string;
  placeholder?: string;
  default?: string;
  options?: { value: string; label: string }[];
};

export type IntegrationDef = {
  id: ProviderId;
  name: string;
  blurb: string;
  docsUrl: string;
  channels: Channel[];
  fields: FieldDef[];
  /** Path on this site that the provider must be told to call. */
  webhook?: { path: string; help: string };
  steps: string[];
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  payments: "Payments",
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
  rates: "Exchange rates",
  catalog: "Catalogue",
};

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "stripe",
    name: "Stripe",
    blurb: "Card payments from anywhere, including UK and international cards. Settles in the currency of your Stripe account.",
    docsUrl: "https://docs.stripe.com/payments/checkout",
    channels: ["payments"],
    fields: [
      { key: "secretKey", label: "Secret key", env: "STRIPE_SECRET_KEY", secret: true, required: ["payments"], placeholder: "sk_live_… or sk_test_…", help: "Stripe Dashboard → Developers → API keys. A restricted key needs Checkout Sessions: write." },
      { key: "webhookSecret", label: "Webhook signing secret", env: "STRIPE_WEBHOOK_SECRET", secret: true, required: ["payments"], placeholder: "whsec_…", help: "Shown when you add the webhook endpoint below." },
      {
        key: "chargeCurrency", label: "Charge customers in", env: "STRIPE_CHARGE_CURRENCY", default: "GBP",
        options: [{ value: "GBP", label: "British pounds (GBP)" }, { value: "GHS", label: "Ghana cedis (GHS)" }],
        help: "GBP works on every UK Stripe account. Choose GHS only if your account can charge in cedis; the customer then sees exactly the cedi total.",
      },
    ],
    webhook: { path: "/api/webhooks/stripe", help: "Listen for: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired." },
    steps: ["Create the keys in the Stripe Dashboard.", "Add a webhook endpoint with the URL below and the events listed.", "Paste the secret key and the signing secret here, save, then press Test."],
  },
  {
    id: "paystack",
    name: "Paystack",
    blurb: "Ghana cards and Mobile Money (MTN, Telecel, AirtelTigo). Customers pay in cedis, settled in GHS.",
    docsUrl: "https://paystack.com/docs/payments/accept-payments/",
    channels: ["payments"],
    fields: [{ key: "secretKey", label: "Secret key", env: "PAYSTACK_SECRET_KEY", secret: true, required: ["payments"], placeholder: "sk_live_… or sk_test_…", help: "Paystack Dashboard → Settings → API Keys & Webhooks." }],
    webhook: { path: "/api/webhooks/paystack", help: "Set this as the Live (or Test) webhook URL in Settings → API Keys & Webhooks. Paystack signs each call with your secret key." },
    steps: ["Copy your secret key from the Paystack Dashboard.", "Set the webhook URL below in the same page.", "Paste the key here, save, then press Test."],
  },
  {
    id: "flutterwave",
    name: "Flutterwave",
    blurb: "Mobile Money, cards and bank payments in Ghana, with GBP collections too. Uses the v3 API.",
    docsUrl: "https://developer.flutterwave.com/v3.0/docs/flutterwave-standard-1",
    channels: ["payments"],
    fields: [
      { key: "secretKey", label: "Secret key", env: "FLUTTERWAVE_SECRET_KEY", secret: true, required: ["payments"], placeholder: "FLWSECK-…", help: "Dashboard → Settings → API keys." },
      { key: "secretHash", label: "Webhook secret hash", env: "FLUTTERWAVE_SECRET_HASH", secret: true, required: ["payments"], help: "A long random value you invent. Enter it here and in Dashboard → Settings → Webhooks." },
    ],
    webhook: { path: "/api/webhooks/flutterwave", help: "Set this as the webhook URL and use the same secret hash. Flutterwave sends it back in the verif-hash header." },
    steps: ["Copy the secret key from the Flutterwave Dashboard.", "Invent a secret hash, enter it here and in the dashboard's webhook settings, with the URL below.", "Save, then press Test."],
  },
  {
    id: "arkesel",
    name: "Arkesel",
    blurb: "Ghana SMS with a branded sender name. Good delivery on all Ghana networks.",
    docsUrl: "https://developers.arkesel.com/",
    channels: ["sms"],
    fields: [
      { key: "apiKey", label: "API key", env: "ARKESEL_API_KEY", secret: true, required: ["sms"], help: "Arkesel dashboard → SMS API." },
      { key: "senderId", label: "Sender name", env: "ARKESEL_SENDER_ID", required: ["sms"], placeholder: "SHOPUKGH", help: "Up to 11 letters or numbers, registered and approved in Arkesel." },
    ],
    steps: ["Register a sender name in Arkesel and wait for approval.", "Paste the API key and sender name, save.", "Send a test message to your own number."],
  },
  {
    id: "twilio",
    name: "Twilio",
    blurb: "SMS and WhatsApp through one account. Works for UK and international numbers.",
    docsUrl: "https://www.twilio.com/docs/messaging",
    channels: ["sms", "whatsapp"],
    fields: [
      { key: "accountSid", label: "Account SID", env: "TWILIO_ACCOUNT_SID", required: ["sms", "whatsapp"], placeholder: "AC…" },
      { key: "authToken", label: "Auth token", env: "TWILIO_AUTH_TOKEN", secret: true, required: ["sms", "whatsapp"] },
      { key: "smsFrom", label: "SMS sender", env: "TWILIO_SMS_FROM", required: ["sms"], placeholder: "+447… or MG… (Messaging Service)", help: "A Twilio number or Messaging Service SID." },
      { key: "whatsappFrom", label: "WhatsApp sender", env: "TWILIO_WHATSAPP_FROM", required: ["whatsapp"], placeholder: "+14155238886", help: "Your approved WhatsApp sender, or the sandbox number while testing." },
      { key: "whatsappContentSid", label: "WhatsApp template SID", env: "TWILIO_WHATSAPP_CONTENT_SID", placeholder: "HX…", help: "Needed to message customers outside a 24-hour chat. Variables: 1 name, 2 order number, 3 update." },
    ],
    steps: ["Copy the Account SID and Auth token from the Twilio console.", "Add an SMS number and/or a WhatsApp sender.", "Save, choose Twilio under SMS and/or WhatsApp above, then send a test."],
  },
  {
    id: "meta_whatsapp",
    name: "WhatsApp Cloud API (Meta)",
    blurb: "Send order updates from your own WhatsApp Business number through Meta directly.",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates",
    channels: ["whatsapp"],
    fields: [
      { key: "accessToken", label: "Access token", env: "WHATSAPP_ACCESS_TOKEN", secret: true, required: ["whatsapp"], help: "Use a permanent system-user token, not the 24-hour test token." },
      { key: "phoneNumberId", label: "Phone number ID", env: "WHATSAPP_PHONE_NUMBER_ID", required: ["whatsapp"] },
      { key: "templateName", label: "Template name", env: "WHATSAPP_TEMPLATE_NAME", required: ["whatsapp"], default: "order_update", help: "An approved UTILITY template with three variables: {{1}} customer name, {{2}} order number, {{3}} the update." },
      { key: "templateLanguage", label: "Template language", env: "WHATSAPP_TEMPLATE_LANGUAGE", default: "en" },
      { key: "graphVersion", label: "Graph API version", env: "WHATSAPP_GRAPH_VERSION", default: "v22.0", help: "Raise this when Meta retires the version." },
    ],
    steps: ["Create a WhatsApp Business app in Meta for Developers and add your number.", "Create and get approval for the order_update template.", "Paste the token and phone number ID, save, then send a test."],
  },
  {
    id: "resend",
    name: "Resend",
    blurb: "Transactional email with a simple API. Verify your domain to send from your own address.",
    docsUrl: "https://resend.com/docs/api-reference/emails/send-email",
    channels: ["email"],
    fields: [
      { key: "apiKey", label: "API key", env: "RESEND_API_KEY", secret: true, required: ["email"], placeholder: "re_…" },
      { key: "from", label: "From address", env: "RESEND_FROM", required: ["email"], placeholder: "SHOP UK FROM GH <orders@yourdomain.com>", help: "The domain must be verified in Resend." },
    ],
    steps: ["Verify your sending domain in Resend.", "Create an API key and paste it with your From address.", "Save, choose Resend under Email above, then send a test."],
  },
  {
    id: "postmark",
    name: "Postmark",
    blurb: "Transactional email with strong delivery. Verify a sender signature or domain first.",
    docsUrl: "https://postmarkapp.com/developer/user-guide/send-email-with-api",
    channels: ["email"],
    fields: [
      { key: "serverToken", label: "Server API token", env: "POSTMARK_SERVER_TOKEN", secret: true, required: ["email"] },
      { key: "from", label: "From address", env: "POSTMARK_FROM", required: ["email"], placeholder: "orders@yourdomain.com", help: "Must match a verified sender signature or domain." },
      { key: "messageStream", label: "Message stream", env: "POSTMARK_MESSAGE_STREAM", default: "outbound" },
    ],
    steps: ["Add a sender signature or domain in Postmark.", "Copy the server token and paste it with your From address.", "Save, choose Postmark under Email above, then send a test."],
  },
  {
    id: "exchangerate_api",
    name: "ExchangeRate-API",
    blurb: "Live pound-to-cedi market rate with a simple key. A free plan covers daily rates.",
    docsUrl: "https://www.exchangerate-api.com/docs/pair-conversion-requests",
    channels: ["rates"],
    fields: [{ key: "apiKey", label: "API key", env: "EXCHANGERATE_API_KEY", secret: true, required: ["rates"], help: "From your ExchangeRate-API dashboard. The key is part of the request address, so it is never logged." }],
    steps: ["Create a free account and copy your API key.", "Paste it here and save.", "Choose ExchangeRate-API under Exchange rate feed above, then press Test."],
  },
  {
    id: "openexchangerates",
    name: "Open Exchange Rates",
    blurb: "Market rates published hourly on paid plans. The free plan works for daily use.",
    docsUrl: "https://docs.openexchangerates.org/reference/latest-json",
    channels: ["rates"],
    fields: [{ key: "appId", label: "App ID", env: "OPENEXCHANGERATES_APP_ID", secret: true, required: ["rates"], help: "From your Open Exchange Rates dashboard. Sent in a header, never in the address." }],
    steps: ["Create an account and copy your App ID.", "Paste it here and save.", "Choose Open Exchange Rates under Exchange rate feed above, then press Test."],
  },
  {
    id: "ebay",
    name: "eBay (official API)",
    blurb: "Real UK listings with real photos and prices, straight from eBay's free Browse API. Used by a Catalogue source of type eBay.",
    docsUrl: "https://developer.ebay.com/api-docs/buy/browse/overview.html",
    channels: ["catalog"],
    fields: [
      { key: "appId", label: "App ID (Client ID)", env: "EBAY_APP_ID", required: ["catalog"], placeholder: "YourName-ShopUKGH-PRD-…", help: "From your eBay developer account, under Application Keys." },
      { key: "certId", label: "Cert ID (Client Secret)", env: "EBAY_CERT_ID", secret: true, required: ["catalog"], placeholder: "PRD-…", help: "From the same page. Keep it private." },
      {
        key: "environment", label: "Environment", env: "EBAY_ENVIRONMENT", default: "production",
        options: [{ value: "production", label: "Production (real listings)" }, { value: "sandbox", label: "Sandbox (test data)" }],
        help: "Use Production for real listings. Production keys need your eBay developer account to be approved.",
      },
    ],
    steps: [
      "Create a free account at developer.ebay.com and open Application Keys.",
      "Create a Production keyset and copy the App ID and Cert ID.",
      "Paste them here, save, then press Test connection.",
      "Add a Catalogue source of type eBay and list the searches you want (one per line).",
      "Read eBay's API licence. It sets how listing data and photos may be shown and requires a link back to the listing.",
    ],
  },
  {
    id: "diffbot",
    name: "Diffbot (Product API)",
    blurb: "Reads the product pages you list and returns the name, price, was-price, stock, brand and photo. Paid (Diffbot credits). Used by a Catalogue source of type Diffbot.",
    docsUrl: "https://docs.diffbot.com/reference/extract-product",
    channels: ["catalog"],
    fields: [
      { key: "token", label: "Diffbot token", env: "DIFFBOT_TOKEN", secret: true, required: ["catalog"], placeholder: "Your Diffbot API token", help: "From your Diffbot dashboard, under API tokens. Keep it private; it is billed to your account." },
    ],
    steps: [
      "Create a Diffbot account (there is a free trial) and copy your API token.",
      "Paste it here, save, switch Diffbot on, then press Test connection (this reads one example page, which uses one credit).",
      "Add a Catalogue source of type Diffbot and list the product page addresses you want, one per line.",
      "Each product read uses Diffbot credits every time the source runs, so keep the list and the run frequency modest.",
      "Diffbot downloads the pages for you, so the shop's own terms still apply. Only list pages you are allowed to use, and tick the permission box on the source.",
    ],
  },
];

export function getIntegration(id: string): IntegrationDef | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}

export function providersFor(channel: Channel): IntegrationDef[] {
  return INTEGRATIONS.filter((i) => i.channels.includes(channel));
}

export type FieldSource = "env" | "admin" | "default" | "missing" | "unreadable";

export type IntegrationConfig = {
  values: Record<string, string>;
  sources: Record<string, FieldSource>;
  enabled: boolean;
};

const rowKey = (k: string) => k;

/** Environment variables win over saved values, so an operator can lock a key down. */
export function readConfig(def: IntegrationDef, d: Db = db(), env: NodeJS.ProcessEnv = process.env): IntegrationConfig {
  const rows = d
    .prepare("SELECT key, value, is_secret FROM integration_settings WHERE provider = ?")
    .all(def.id) as { key: string; value: string; is_secret: number }[];
  const saved = new Map(rows.map((r) => [r.key, r]));
  const pass = encryptionPassphrase(env);
  const values: Record<string, string> = {};
  const sources: Record<string, FieldSource> = {};

  for (const f of def.fields) {
    const fromEnv = env[f.env]?.trim();
    if (fromEnv) {
      values[f.key] = fromEnv;
      sources[f.key] = "env";
      continue;
    }
    const row = saved.get(rowKey(f.key));
    if (row) {
      const v = row.is_secret ? (pass ? decrypt(row.value, pass) : null) : row.value;
      if (v === null) {
        sources[f.key] = "unreadable";
        continue;
      }
      values[f.key] = v;
      sources[f.key] = "admin";
      continue;
    }
    if (f.default !== undefined) {
      values[f.key] = f.default;
      sources[f.key] = "default";
      continue;
    }
    sources[f.key] = "missing";
  }
  return { values, sources, enabled: saved.get("_enabled")?.value !== "0" };
}

export function isConfigured(def: IntegrationDef, cfg: IntegrationConfig, channel: Channel): boolean {
  return def.fields.filter((f) => f.required?.includes(channel)).every((f) => Boolean(cfg.values[f.key]));
}

/** Which of a provider's channels are ready to use right now. */
export function readyChannels(def: IntegrationDef, cfg: IntegrationConfig): Channel[] {
  return def.channels.filter((c) => isConfigured(def, cfg, c));
}

export type SaveResult = { ok: true; changed: number } | { ok: false; error: string };

/**
 * Save the submitted values. A blank secret keeps what is already stored; a field set
 * by an environment variable is left alone; a blank plain field falls back to its default.
 * Fields missing from `submitted` are not touched.
 */
export function saveFields(
  def: IntegrationDef,
  submitted: Record<string, string>,
  d: Db = db(),
  env: NodeJS.ProcessEnv = process.env,
): SaveResult {
  const pass = encryptionPassphrase(env);
  const put = d.prepare(
    `INSERT INTO integration_settings (provider, key, value, is_secret, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(provider, key) DO UPDATE SET value = excluded.value, is_secret = excluded.is_secret, updated_at = excluded.updated_at`,
  );
  const del = d.prepare("DELETE FROM integration_settings WHERE provider = ? AND key = ?");
  let changed = 0;

  for (const f of def.fields) {
    if (env[f.env]?.trim()) continue;
    if (!(f.key in submitted)) continue; // only touch fields that were actually submitted
    const raw = (submitted[f.key] ?? "").trim();
    if (raw.length > 500) return { ok: false, error: `${f.label} is too long.` };
    if (f.options && raw && !f.options.some((o) => o.value === raw)) return { ok: false, error: `${f.label} has an unknown choice.` };
    if (f.secret) {
      if (!raw) continue;
      if (/\s/.test(raw)) return { ok: false, error: `${f.label} must not contain spaces. Check what you pasted.` };
      if (!pass) return { ok: false, error: "Keys cannot be saved until SETTINGS_ENCRYPTION_KEY or ADMIN_SECRET is set on the server." };
      put.run(def.id, f.key, encrypt(raw, pass), 1);
      changed++;
    } else if (raw) {
      put.run(def.id, f.key, raw, 0);
      changed++;
    } else {
      del.run(def.id, f.key);
    }
  }
  return { ok: true, changed };
}

export function clearField(def: IntegrationDef, key: string, d: Db = db()): void {
  if (!def.fields.some((f) => f.key === key)) return;
  d.prepare("DELETE FROM integration_settings WHERE provider = ? AND key = ?").run(def.id, key);
}

export function setEnabled(def: IntegrationDef, enabled: boolean, d: Db = db()): void {
  d.prepare(
    `INSERT INTO integration_settings (provider, key, value, is_secret, updated_at) VALUES (?, '_enabled', ?, 0, datetime('now'))
     ON CONFLICT(provider, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(def.id, enabled ? "1" : "0");
}

/** "test", "live" or null, read from the key's prefix. Never exposes the key. */
export function keyMode(id: ProviderId, values: Record<string, string>): "test" | "live" | null {
  const k = values.secretKey ?? values.accessToken ?? "";
  if (!k) return null;
  if (id === "stripe" || id === "paystack") return /_test_/.test(k) ? "test" : /_live_/.test(k) ? "live" : null;
  if (id === "flutterwave") return /TEST/.test(k) ? "test" : /^FLWSECK/.test(k) ? "live" : null;
  return null;
}

// ---- channel selection ----------------------------------------------------------

const channelKey = (c: Channel) => `channel.${c}`;

export function getChannelProviderId(channel: Channel, d: Db = db()): ProviderId | null {
  const v = getSetting<string>(channelKey(channel), d);
  return typeof v === "string" && providersFor(channel).some((p) => p.id === v) ? (v as ProviderId) : null;
}

export function setChannelProvider(channel: Channel, id: ProviderId | "", d: Db = db()): boolean {
  if (id !== "" && !providersFor(channel).some((p) => p.id === id)) return false;
  setSetting(channelKey(channel), id, d);
  return true;
}

/** The provider chosen for a messaging channel, if it is enabled and fully configured. */
export function activeMessagingProvider(
  channel: Exclude<Channel, "payments" | "catalog">,
  d: Db = db(),
  env: NodeJS.ProcessEnv = process.env,
): { def: IntegrationDef; cfg: IntegrationConfig } | null {
  const id = getChannelProviderId(channel, d);
  const def = id ? getIntegration(id) : undefined;
  if (!def) return null;
  const cfg = readConfig(def, d, env);
  return cfg.enabled && isConfigured(def, cfg, channel) ? { def, cfg } : null;
}

/** Payment gateways that are enabled and fully configured. */
export function activePaymentProviders(d: Db = db(), env: NodeJS.ProcessEnv = process.env): { def: IntegrationDef; cfg: IntegrationConfig }[] {
  return providersFor("payments")
    .map((def) => ({ def, cfg: readConfig(def, d, env) }))
    .filter(({ def, cfg }) => cfg.enabled && isConfigured(def, cfg, "payments"));
}
