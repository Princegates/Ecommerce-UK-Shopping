import type Database from "better-sqlite3";
import { db } from "./db";
import { getProductById, type Product } from "./catalog";

type Db = Database.Database;

export const MAX_WISHLIST = 200;

/** Add or remove an item. Returns true when the item is now saved. */
export function toggleWishlist(customerId: number, productId: number, d: Db = db()): boolean {
  if (!getProductById(productId, d)) return false;
  const had = d.prepare("DELETE FROM wishlist_items WHERE customer_id = ? AND product_id = ?").run(customerId, productId).changes > 0;
  if (had) return false;
  const n = (d.prepare("SELECT COUNT(*) AS n FROM wishlist_items WHERE customer_id = ?").get(customerId) as { n: number }).n;
  if (n >= MAX_WISHLIST) return false;
  d.prepare("INSERT OR IGNORE INTO wishlist_items (customer_id, product_id) VALUES (?, ?)").run(customerId, productId);
  return true;
}

export function wishlistIds(customerId: number | null, d: Db = db()): Set<number> {
  if (!customerId) return new Set();
  const rows = d.prepare("SELECT product_id FROM wishlist_items WHERE customer_id = ?").all(customerId) as { product_id: number }[];
  return new Set(rows.map((r) => r.product_id));
}

export function listWishlist(customerId: number, d: Db = db()): Product[] {
  const rows = d.prepare("SELECT product_id FROM wishlist_items WHERE customer_id = ? ORDER BY created_at DESC, product_id DESC").all(customerId) as {
    product_id: number;
  }[];
  return rows.map((r) => getProductById(r.product_id, d)).filter((p): p is Product => p !== null);
}
