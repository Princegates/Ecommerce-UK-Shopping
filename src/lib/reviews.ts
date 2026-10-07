import type Database from "better-sqlite3";
import { db } from "./db";

type Db = Database.Database;

export type Review = { id: number; rating: number; title: string; body: string; author: string; createdAt: string };
export type RatingSummary = { average: number | null; count: number; counts: Record<1 | 2 | 3 | 4 | 5, number> };

export function listReviews(productId: number, limit = 50, d: Db = db()): Review[] {
  const rows = d
    .prepare("SELECT id, rating, title, body, author, created_at FROM reviews WHERE product_id = ? AND status = 'PUBLISHED' ORDER BY id DESC LIMIT ?")
    .all(productId, limit) as { id: number; rating: number; title: string; body: string; author: string; created_at: string }[];
  return rows.map((r) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, author: r.author, createdAt: r.created_at }));
}

export function ratingSummary(productId: number, d: Db = db()): RatingSummary {
  const rows = d
    .prepare("SELECT rating, COUNT(*) AS n FROM reviews WHERE product_id = ? AND status = 'PUBLISHED' GROUP BY rating")
    .all(productId) as { rating: 1 | 2 | 3 | 4 | 5; n: number }[];
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as RatingSummary["counts"];
  let total = 0;
  let sum = 0;
  for (const r of rows) {
    counts[r.rating] = r.n;
    total += r.n;
    sum += r.rating * r.n;
  }
  return { average: total ? Math.round((sum / total) * 10) / 10 : null, count: total, counts };
}

export type ReviewEligibility = "yes" | "already" | "not-purchased";

/** Only people who received the item can review it, once. This keeps ratings honest. */
export function reviewEligibility(customerId: number, productId: number, d: Db = db()): ReviewEligibility {
  if (d.prepare("SELECT 1 FROM reviews WHERE customer_id = ? AND product_id = ?").get(customerId, productId)) return "already";
  const bought = d
    .prepare(
      `SELECT 1 FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.customer_id = ? AND i.product_id = ? AND o.status = 'DELIVERED' LIMIT 1`,
    )
    .get(customerId, productId);
  return bought ? "yes" : "not-purchased";
}

/** "Ama Mensah" is shown as "Ama M." */
export function displayName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0] || "Customer";
}

export function addReview(
  customerId: number,
  customerName: string,
  productId: number,
  input: { rating: number; title: string; body: string },
  d: Db = db(),
): { ok: true } | { ok: false; error: string } {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return { ok: false, error: "Choose a rating from 1 to 5 stars." };
  const title = input.title.trim().slice(0, 100);
  const body = input.body.trim().slice(0, 2000);
  if (!title && body.length < 5) return { ok: false, error: "Add a few words about the item." };
  const elig = reviewEligibility(customerId, productId, d);
  if (elig === "already") return { ok: false, error: "You have already reviewed this item." };
  if (elig === "not-purchased") return { ok: false, error: "You can review an item once your order for it has been delivered." };
  d.prepare("INSERT INTO reviews (product_id, customer_id, author, rating, title, body) VALUES (?, ?, ?, ?, ?, ?)").run(
    productId, customerId, displayName(customerName), input.rating, title, body,
  );
  return { ok: true };
}

export type AdminReview = Review & { productName: string; status: string };

export function adminReviews(status: string | undefined, d: Db = db()): AdminReview[] {
  const rows = d
    .prepare(
      `SELECT r.id, r.rating, r.title, r.body, r.author, r.created_at, r.status, p.name AS product_name
       FROM reviews r JOIN products p ON p.id = r.product_id ${status === "PUBLISHED" || status === "HIDDEN" ? "WHERE r.status = ?" : ""} ORDER BY r.id DESC LIMIT 200`,
    )
    .all(...(status === "PUBLISHED" || status === "HIDDEN" ? [status] : [])) as {
    id: number; rating: number; title: string; body: string; author: string; created_at: string; status: string; product_name: string;
  }[];
  return rows.map((r) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, author: r.author, createdAt: r.created_at, status: r.status, productName: r.product_name }));
}

export function setReviewStatus(id: number, status: "PUBLISHED" | "HIDDEN", d: Db = db()): boolean {
  return d.prepare("UPDATE reviews SET status = ? WHERE id = ?").run(status, id).changes > 0;
}
