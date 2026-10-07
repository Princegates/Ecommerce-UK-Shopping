import type Database from "better-sqlite3";
import { db } from "../db";
import { markPaid } from "../orders";
import type { Currency, WebhookOutcome } from "./types";

type Db = Database.Database;

export type AttemptRow = {
  id: number;
  orderId: number;
  provider: string;
  providerRef: string;
  attemptRef: string;
  status: string;
  currency: string;
  amountMinor: number;
  note: string;
  createdAt: string;
};

type Raw = {
  id: number; order_id: number; provider: string; provider_ref: string; attempt_ref: string; status: string;
  currency: string; amount_minor: number; note: string; created_at: string;
};

const toAttempt = (r: Raw): AttemptRow => ({
  id: r.id, orderId: r.order_id, provider: r.provider, providerRef: r.provider_ref, attemptRef: r.attempt_ref,
  status: r.status, currency: r.currency, amountMinor: r.amount_minor, note: r.note, createdAt: r.created_at,
});

export function createAttempt(
  a: { orderId: number; provider: string; providerRef: string; attemptRef: string; currency: Currency; amountMinor: number },
  d: Db = db(),
): void {
  d.prepare(
    "INSERT INTO payments (order_id, provider, provider_ref, attempt_ref, currency, amount_minor) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(a.orderId, a.provider, a.providerRef, a.attemptRef, a.currency, a.amountMinor);
}

export function attemptsForOrder(orderId: number, d: Db = db()): AttemptRow[] {
  return (d.prepare("SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC").all(orderId) as Raw[]).map(toAttempt);
}

export function pendingAttempts(orderId: number, d: Db = db()): AttemptRow[] {
  return (d.prepare("SELECT * FROM payments WHERE order_id = ? AND status = 'PENDING' ORDER BY id DESC").all(orderId) as Raw[]).map(toAttempt);
}

export function recentAttempts(limit = 40, d: Db = db()): (AttemptRow & { orderNumber: string })[] {
  const rows = d
    .prepare("SELECT p.*, o.number AS order_number FROM payments p JOIN orders o ON o.id = p.order_id ORDER BY p.id DESC LIMIT ?")
    .all(limit) as (Raw & { order_number: string })[];
  return rows.map((r) => ({ ...toAttempt(r), orderNumber: r.order_number }));
}

export type ConfirmResult = "confirmed" | "already" | "unknown" | "mismatch";

/**
 * Accept a "paid" report from a gateway. The order is only marked paid when the gateway's
 * amount and currency equal what we asked it to charge for this attempt. Replays are harmless.
 */
export function confirmPaid(
  provider: string,
  providerRef: string,
  amountMinor: number,
  currency: string,
  d: Db = db(),
): ConfirmResult {
  const run = d.transaction((): ConfirmResult => {
    const row = d.prepare("SELECT * FROM payments WHERE provider = ? AND provider_ref = ?").get(provider, providerRef) as Raw | undefined;
    if (!row) return "unknown";
    if (row.status === "SUCCEEDED") return "already";
    const order = d.prepare("SELECT payment_ref FROM orders WHERE id = ?").get(row.order_id) as { payment_ref: string };

    if (row.currency !== currency.toUpperCase() || row.amount_minor !== amountMinor) {
      d.prepare("UPDATE payments SET status = 'MISMATCH', note = ?, updated_at = datetime('now') WHERE id = ?").run(
        `Gateway reported ${amountMinor} ${currency}, expected ${row.amount_minor} ${row.currency}`, row.id,
      );
      d.prepare("INSERT INTO order_events (order_id, status, note) VALUES (?, (SELECT status FROM orders WHERE id = ?), ?)").run(
        row.order_id, row.order_id, `A ${provider} payment did not match the amount due and needs review.`,
      );
      return "mismatch";
    }

    d.prepare("UPDATE payments SET status = 'SUCCEEDED', updated_at = datetime('now') WHERE id = ?").run(row.id);
    markPaid(order.payment_ref, d, `Paid with ${provider}`);
    return "confirmed";
  });
  return run();
}

export function failAttempt(provider: string, providerRef: string, note: string, d: Db = db()): boolean {
  return (
    d
      .prepare("UPDATE payments SET status = 'FAILED', note = ?, updated_at = datetime('now') WHERE provider = ? AND provider_ref = ? AND status = 'PENDING'")
      .run(note.slice(0, 200), provider, providerRef).changes > 0
  );
}

/** Apply one verified gateway outcome exactly once. */
export function applyOutcome(provider: string, outcome: WebhookOutcome, d: Db = db()): ConfirmResult | "ignored" | "duplicate" {
  if (outcome.kind === "ignored") return "ignored";
  const run = d.transaction((): ConfirmResult | "duplicate" => {
    const seen = d.prepare("INSERT OR IGNORE INTO webhook_events (provider, event_id) VALUES (?, ?)").run(provider, outcome.eventId);
    if (seen.changes === 0) return "duplicate";
    if (outcome.kind === "paid") return confirmPaid(provider, outcome.providerRef, outcome.amountMinor, outcome.currency, d);
    failAttempt(provider, outcome.providerRef, "Reported failed by the gateway", d);
    return "unknown";
  });
  return run();
}

export function lastWebhookAt(provider: string, d: Db = db()): string | null {
  const r = d.prepare("SELECT MAX(received_at) AS t FROM webhook_events WHERE provider = ?").get(provider) as { t: string | null };
  return r.t;
}
