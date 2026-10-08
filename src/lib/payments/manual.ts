import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { db } from "../db";
import { markPaid } from "../orders";

type Db = Database.Database;

export const MANUAL_METHODS = [
  { key: "bank_transfer", label: "Bank transfer" },
  { key: "mobile_money", label: "Mobile Money sent to us directly" },
  { key: "cash", label: "Cash" },
  { key: "gateway_dashboard", label: "Paid at the gateway, but the site was not told" },
  { key: "other", label: "Other" },
] as const;

export type ManualMethod = (typeof MANUAL_METHODS)[number]["key"];
export const isManualMethod = (v: unknown): v is ManualMethod => MANUAL_METHODS.some((m) => m.key === v);

export type ManualPaymentInput = { method: string; reference: string; reason: string; by: string };

/**
 * The staff override for when money has really arrived but the payment flow did not record it (no gateway set up, a missed webhook,
 * a bank transfer). It goes through the same markPaid as a gateway, so the order moves on once, customers are messaged once, and a
 * second click changes nothing. It leaves a payment row and a note on the order so the Payments panel shows how it was paid and by whom.
 * The customer sees only "Payment received"; the reference and reason stay with staff and the activity log.
 */
export function confirmPaymentManually(
  orderId: number,
  i: ManualPaymentInput,
  d: Db = db(),
): { ok: true; detail: string } | { ok: false; error: string } {
  const reference = i.reference.trim().slice(0, 120);
  const reason = i.reason.trim().slice(0, 300);
  if (!isManualMethod(i.method)) return { ok: false, error: "Choose how the money was received." };
  if (reference.length < 3) return { ok: false, error: "Enter the bank, Mobile Money or gateway reference for this payment." };
  if (reason.length < 10) return { ok: false, error: "Say why you are confirming this by hand (at least a short sentence)." };

  const method = MANUAL_METHODS.find((m) => m.key === i.method)!;
  const run = d.transaction((): { ok: true; detail: string } | { ok: false; error: string } => {
    const o = d.prepare("SELECT id, status, payment_status, payment_ref, total_minor FROM orders WHERE id = ?").get(orderId) as
      | { id: number; status: string; payment_status: string; payment_ref: string; total_minor: number }
      | undefined;
    if (!o) return { ok: false, error: "Order not found." };
    if (o.payment_status === "PAID" || o.payment_status === "REFUNDED") return { ok: false, error: "This order is already marked as paid." };
    if (o.status !== "AWAITING_PAYMENT") return { ok: false, error: "Only an order that is still awaiting payment can be confirmed by hand." };

    const dup = d
      .prepare("SELECT o.number FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.provider = 'manual' AND p.note LIKE ? ESCAPE '\\'")
      .get(`${method.label}, ref ${reference.replace(/[\\%_]/g, (c) => "\\" + c)}.%`) as { number: string } | undefined;
    if (dup) return { ok: false, error: `That reference was already used to confirm order ${dup.number}.` };

    const detail = `${method.label}, ref ${reference}. ${reason}`;
    d.prepare(
      "INSERT INTO payments (order_id, provider, provider_ref, attempt_ref, status, currency, amount_minor, note) VALUES (?, 'manual', ?, ?, 'SUCCEEDED', 'GHS', ?, ?)",
    ).run(o.id, `manual_${randomUUID()}`, `manual_${randomUUID()}`, o.total_minor, `${detail} (by ${i.by.slice(0, 80)})`.slice(0, 500));
    d.prepare("UPDATE payments SET status = 'SUPERSEDED', updated_at = datetime('now') WHERE order_id = ? AND status = 'PENDING'").run(o.id);
    markPaid(o.payment_ref, d, `Payment received (${method.label.toLowerCase()})`);
    return { ok: true, detail };
  });
  return run();
}
