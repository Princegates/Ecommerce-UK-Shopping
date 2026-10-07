import type Database from "better-sqlite3";
import { appUrl } from "../app-url";
import { db } from "../db";
import {
  activeMessagingProvider, getIntegration, isConfigured, readConfig, type Channel, type IntegrationConfig, type ProviderId,
} from "../integrations";
import { ORDER_STATUSES, isOrderStatus, type OrderStatus } from "../order-status";
import { getSetting, getSettings, setSetting } from "../settings";
import { isEmail, toE164 } from "./phone";
import {
  sendArkesel, sendMetaWhatsapp, sendPostmark, sendResend, twilioSms, twilioWhatsapp, type EmailContent, type FetchLike, type SendResult,
  type TemplateVars,
} from "./senders";
import { renderOrderMessage, renderTestMessage, type Rendered } from "./templates";

type Db = Database.Database;
export type MessageChannel = Exclude<Channel, "payments" | "rates">;
export const MESSAGE_CHANNELS: MessageChannel[] = ["sms", "whatsapp", "email"];
const MAX_ATTEMPTS = 3;
const STALE_LOCK_MINUTES = 5;

// ---------------------------------------------------------------- rules

export type NotifyRules = Record<OrderStatus, Record<MessageChannel, boolean>>;

const ALL = { sms: true, whatsapp: true, email: true };
const EMAIL_ONLY = { sms: false, whatsapp: false, email: true };
const NONE = { sms: false, whatsapp: false, email: false };

/** Which updates go out on which channel unless an admin changes it. */
export const DEFAULT_RULES: NotifyRules = {
  AWAITING_PAYMENT: NONE,
  PAID: ALL,
  PURCHASING: EMAIL_ONLY,
  PURCHASED: EMAIL_ONLY,
  AT_UK_WAREHOUSE: ALL,
  SHIPPED_TO_GHANA: ALL,
  IN_CUSTOMS: EMAIL_ONLY,
  OUT_FOR_DELIVERY: ALL,
  DELIVERED: ALL,
  CANCELLED: ALL,
  REFUNDED: ALL,
};

export function getRules(d: Db = db()): NotifyRules {
  const saved = getSetting<Partial<NotifyRules>>("notify_rules", d) ?? {};
  const out = {} as NotifyRules;
  for (const s of ORDER_STATUSES) {
    out[s] = { ...DEFAULT_RULES[s], ...(saved[s] ?? {}) };
    for (const c of MESSAGE_CHANNELS) out[s][c] = out[s][c] === true;
  }
  return out;
}

export function saveRules(rules: NotifyRules, d: Db = db()): void {
  setSetting("notify_rules", rules, d);
}

// ------------------------------------------------------------- enqueueing

type OrderForMessage = {
  id: number; number: string; customer_name: string; phone: string; email: string; total_minor: number;
  payment_ref: string; notify_sms: number; notify_email: number; notify_whatsapp: number;
};

type Draft = { channel: MessageChannel; recipient: string; event: string; subject: string; body: string; payload: string; orderId: number | null };

function insertMessage(m: Draft, d: Db): boolean {
  if (m.orderId !== null && d.prepare("SELECT 1 FROM messages WHERE order_id = ? AND event = ? AND channel = ?").get(m.orderId, m.event, m.channel)) {
    return false;
  }
  d.prepare("INSERT INTO messages (order_id, channel, recipient, event, subject, body, payload) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    m.orderId, m.channel, m.recipient, m.event, m.subject, m.body, m.payload,
  );
  return true;
}

function draftFor(channel: MessageChannel, rendered: Rendered, recipient: string, event: string, orderId: number | null): Draft {
  if (channel === "sms") return { channel, recipient, event, subject: "", body: rendered.sms, payload: "", orderId };
  if (channel === "whatsapp") return { channel, recipient, event, subject: "", body: rendered.whatsappText, payload: JSON.stringify(rendered.vars), orderId };
  return { channel, recipient, event, subject: rendered.email.subject, body: rendered.email.text, payload: JSON.stringify({ html: rendered.email.html }), orderId };
}

/**
 * Queue the messages an order update should produce. Only channels that have an enabled,
 * fully configured provider, an admin rule, the customer's consent and a valid address get a row.
 */
export function enqueueOrderEvent(orderId: number, status: OrderStatus, d: Db = db(), env: NodeJS.ProcessEnv = process.env): number {
  const o = d.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderForMessage | undefined;
  if (!o) return 0;
  const rules = getRules(d)[status];
  const base = appUrl(env);
  const rendered = renderOrderMessage({
    siteName: getSettings(d).siteName, customerName: o.customer_name, orderNumber: o.number, totalMinor: o.total_minor,
    link: base ? `${base}/order/${o.payment_ref}` : null, status,
  });
  const phone = toE164(o.phone);
  const wants: Record<MessageChannel, { allowed: boolean; to: string | null }> = {
    sms: { allowed: o.notify_sms === 1, to: phone },
    whatsapp: { allowed: o.notify_whatsapp === 1, to: phone },
    email: { allowed: o.notify_email === 1, to: isEmail(o.email) ? o.email : null },
  };
  let queued = 0;
  for (const channel of MESSAGE_CHANNELS) {
    const w = wants[channel];
    if (!rules[channel] || !w.allowed || !w.to || !activeMessagingProvider(channel, d, env)) continue;
    if (insertMessage(draftFor(channel, rendered, w.to, status, orderId), d)) queued++;
  }
  return queued;
}

/** Queue one message that is not tied to an order, such as a password reset. First available channel wins. */
export function enqueueDirect(
  target: { phone?: string; email?: string },
  rendered: Rendered,
  event: string,
  d: Db = db(),
  env: NodeJS.ProcessEnv = process.env,
): MessageChannel | null {
  const options: [MessageChannel, string | null][] = [
    ["email", target.email && isEmail(target.email) ? target.email : null],
    ["sms", target.phone ? toE164(target.phone) : null],
  ];
  for (const [channel, to] of options) {
    if (!to || !activeMessagingProvider(channel, d, env)) continue;
    insertMessage(draftFor(channel, rendered, to, event, null), d);
    return channel;
  }
  return null;
}

// ---------------------------------------------------------------- delivery

function str(cfg: IntegrationConfig, k: string): string {
  return cfg.values[k] ?? "";
}

export async function deliver(
  providerId: ProviderId,
  channel: MessageChannel,
  cfg: IntegrationConfig,
  m: { recipient: string; body: string; subject: string; payload: string },
  f: FetchLike = fetch,
): Promise<SendResult> {
  const payload = (() => {
    try {
      return m.payload ? JSON.parse(m.payload) : {};
    } catch {
      return {};
    }
  })() as Record<string, unknown>;
  const email: EmailContent = { subject: m.subject, text: m.body, html: typeof payload.html === "string" ? payload.html : `<p>${m.body}</p>` };
  const vars: TemplateVars = {
    name: String(payload.name ?? ""), orderNumber: String(payload.orderNumber ?? ""), update: String(payload.update ?? m.body),
  };

  try {
    switch (`${providerId}:${channel}`) {
      case "arkesel:sms":
        return await sendArkesel({ apiKey: str(cfg, "apiKey"), senderId: str(cfg, "senderId") }, m.recipient, m.body, f);
      case "twilio:sms":
        return await twilioSms({ accountSid: str(cfg, "accountSid"), authToken: str(cfg, "authToken"), smsFrom: str(cfg, "smsFrom") }, m.recipient, m.body, f);
      case "twilio:whatsapp":
        return await twilioWhatsapp(
          { accountSid: str(cfg, "accountSid"), authToken: str(cfg, "authToken"), whatsappFrom: str(cfg, "whatsappFrom"), whatsappContentSid: str(cfg, "whatsappContentSid") || undefined },
          m.recipient, m.body, vars, f,
        );
      case "meta_whatsapp:whatsapp":
        return await sendMetaWhatsapp(
          { accessToken: str(cfg, "accessToken"), phoneNumberId: str(cfg, "phoneNumberId"), templateName: str(cfg, "templateName"), templateLanguage: str(cfg, "templateLanguage") || "en", graphVersion: str(cfg, "graphVersion") || "v22.0" },
          m.recipient, vars, f,
        );
      case "resend:email":
        return await sendResend({ apiKey: str(cfg, "apiKey"), from: str(cfg, "from") }, m.recipient, email, f);
      case "postmark:email":
        return await sendPostmark({ serverToken: str(cfg, "serverToken"), from: str(cfg, "from"), messageStream: str(cfg, "messageStream") || "outbound" }, m.recipient, email, f);
      default:
        return { ok: false, error: `${providerId} cannot send ${channel}.` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "The provider did not answer in time." : "Could not reach the provider." };
  }
}

type Row = { id: number; channel: MessageChannel; recipient: string; subject: string; body: string; payload: string; attempts: number };

/** Send queued messages. Rows are claimed first so two runs never send the same message. */
export async function processOutbox(
  d: Db = db(),
  env: NodeJS.ProcessEnv = process.env,
  f: FetchLike = fetch,
  limit = 20,
): Promise<{ sent: number; failed: number; retrying: number }> {
  d.prepare(`UPDATE messages SET status = 'PENDING', locked_at = NULL WHERE status = 'SENDING' AND locked_at < datetime('now', ?)`).run(`-${STALE_LOCK_MINUTES} minutes`);
  const rows = d.prepare("SELECT id, channel, recipient, subject, body, payload, attempts FROM messages WHERE status = 'PENDING' AND attempts < ? ORDER BY id LIMIT ?").all(MAX_ATTEMPTS, limit) as Row[];
  const claim = d.prepare("UPDATE messages SET status = 'SENDING', locked_at = datetime('now') WHERE id = ? AND status = 'PENDING'");
  const done = d.prepare("UPDATE messages SET status = 'SENT', provider = ?, sent_at = datetime('now'), attempts = attempts + 1, error = '', locked_at = NULL WHERE id = ?");
  const bad = d.prepare("UPDATE messages SET status = ?, provider = ?, attempts = attempts + 1, error = ?, locked_at = NULL WHERE id = ?");
  const out = { sent: 0, failed: 0, retrying: 0 };

  for (const r of rows) {
    if (claim.run(r.id).changes === 0) continue;
    const active = activeMessagingProvider(r.channel, d, env);
    if (!active) {
      bad.run("FAILED", "", "No provider is active for this channel.", r.id);
      out.failed++;
      continue;
    }
    const res = await deliver(active.def.id, r.channel, active.cfg, r, f);
    if (res.ok) {
      done.run(active.def.id, r.id);
      out.sent++;
    } else if (r.attempts + 1 >= MAX_ATTEMPTS) {
      bad.run("FAILED", active.def.id, res.error.slice(0, 300), r.id);
      out.failed++;
    } else {
      bad.run("PENDING", active.def.id, res.error.slice(0, 300), r.id);
      out.retrying++;
    }
  }
  return out;
}

export function retryMessage(id: number, d: Db = db()): boolean {
  return d.prepare("UPDATE messages SET status = 'PENDING', attempts = 0, error = '', locked_at = NULL WHERE id = ? AND status = 'FAILED'").run(id).changes > 0;
}

/** Send a test through one provider, whether or not it is currently selected, to confirm its keys work. */
export async function sendTest(
  providerId: ProviderId,
  channel: MessageChannel,
  to: string,
  d: Db = db(),
  env: NodeJS.ProcessEnv = process.env,
  f: FetchLike = fetch,
): Promise<SendResult> {
  const def = getIntegration(providerId);
  if (!def || !def.channels.includes(channel)) return { ok: false, error: "That provider does not support this channel." };
  const cfg = readConfig(def, d, env);
  if (!isConfigured(def, cfg, channel)) return { ok: false, error: "Fill in and save the required fields first." };
  const recipient = channel === "email" ? (isEmail(to.trim()) ? to.trim() : null) : toE164(to);
  if (!recipient) return { ok: false, error: channel === "email" ? "Enter a valid email address." : "Enter a valid phone number, for example 024 123 4567." };
  const rendered = renderTestMessage(getSettings(d).siteName);
  const draft = draftFor(channel, rendered, recipient, "test", null);
  return deliver(providerId, channel, cfg, draft, f);
}

export type MessageRow = {
  id: number; orderNumber: string | null; channel: string; provider: string; recipient: string; event: string;
  status: string; attempts: number; error: string; createdAt: string; sentAt: string | null;
};

export function recentMessages(limit = 100, d: Db = db()): MessageRow[] {
  const rows = d
    .prepare("SELECT m.*, o.number AS order_number FROM messages m LEFT JOIN orders o ON o.id = m.order_id ORDER BY m.id DESC LIMIT ?")
    .all(limit) as Record<string, any>[];
  return rows.map((r) => ({
    id: r.id, orderNumber: r.order_number ?? null, channel: r.channel, provider: r.provider, recipient: maskRecipient(r.recipient),
    event: r.event, status: r.status, attempts: r.attempts, error: r.error, createdAt: r.created_at, sentAt: r.sent_at,
  }));
}

export function messageStats(days = 7, d: Db = db()): { sent: number; failed: number; pending: number } {
  const r = d
    .prepare(
      `SELECT SUM(status = 'SENT') AS sent, SUM(status = 'FAILED') AS failed, SUM(status IN ('PENDING','SENDING')) AS pending
       FROM messages WHERE created_at >= datetime('now', ?)`,
    )
    .get(`-${days} days`) as { sent: number | null; failed: number | null; pending: number | null };
  return { sent: r.sent ?? 0, failed: r.failed ?? 0, pending: r.pending ?? 0 };
}

/** Admins see enough to recognise a recipient, not their full number or address. */
export function maskRecipient(v: string): string {
  if (v.includes("@")) {
    const [u, host] = v.split("@");
    return `${u.slice(0, 1)}•••@${host}`;
  }
  return v.length > 6 ? `${v.slice(0, 4)}••••${v.slice(-3)}` : "••••";
}

export { isOrderStatus };
