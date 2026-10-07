import "server-only";
import { randomBytes } from "node:crypto";
import type Database from "better-sqlite3";
import { cookies } from "next/headers";
import { db } from "./db";
import { getProductById, type Product } from "./catalog";

type Db = Database.Database;

const COOKIE = "cart";
const MAX_QTY = 20;

export type CartLine = {
  itemId: number;
  product: Product;
  quantity: number;
  options: Record<string, string>;
};

export async function readCartToken(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value;
  return v && /^[A-Za-z0-9_-]{20,64}$/.test(v) ? v : null;
}

/** Only callable from a server action or route handler (it may set a cookie). */
export async function ensureCartToken(d: Db = db()): Promise<string> {
  const existing = await readCartToken();
  if (existing) {
    d.prepare("INSERT OR IGNORE INTO carts (token) VALUES (?)").run(existing);
    return existing;
  }
  const token = randomBytes(24).toString("base64url");
  d.prepare("INSERT INTO carts (token) VALUES (?)").run(token);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return token;
}

export function loadCart(token: string | null, d: Db = db()): CartLine[] {
  if (!token) return [];
  const rows = d
    .prepare("SELECT id, product_id, quantity, options FROM cart_items WHERE cart_token = ? ORDER BY id")
    .all(token) as { id: number; product_id: number; quantity: number; options: string }[];
  const lines: CartLine[] = [];
  for (const r of rows) {
    const product = getProductById(r.product_id, d);
    if (!product) continue; // product was hidden after being added
    let options: Record<string, string> = {};
    try {
      options = JSON.parse(r.options);
    } catch {
      options = {};
    }
    lines.push({ itemId: r.id, product, quantity: r.quantity, options });
  }
  return lines;
}

export async function getCart(): Promise<CartLine[]> {
  return loadCart(await readCartToken());
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}

export type AddResult = { ok: true } | { ok: false; error: string };

/** Validate the chosen options against the product's option groups and return them in group order. */
export function normaliseOptions(
  product: Product,
  chosen: Record<string, string>,
): { ok: true; options: Record<string, string> } | { ok: false; error: string } {
  const out: Record<string, string> = {};
  for (const group of product.options) {
    const value = chosen[group.name];
    if (!value) return { ok: false, error: `Choose a ${group.name.toLowerCase()}.` };
    if (!group.values.includes(value)) return { ok: false, error: `That ${group.name.toLowerCase()} is not available.` };
    out[group.name] = value;
  }
  return { ok: true, options: out };
}

export function addToCart(
  token: string,
  productId: number,
  quantity: number,
  chosen: Record<string, string>,
  d: Db = db(),
): AddResult {
  const product = getProductById(productId, d);
  if (!product) return { ok: false, error: "This item is no longer available." };
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, error: "Choose a quantity of at least 1." };
  const opts = normaliseOptions(product, chosen);
  if (!opts.ok) return opts;
  const key = JSON.stringify(opts.options);
  const existing = d
    .prepare("SELECT id, quantity FROM cart_items WHERE cart_token = ? AND product_id = ? AND options = ?")
    .get(token, productId, key) as { id: number; quantity: number } | undefined;
  if (existing) {
    d.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").run(Math.min(MAX_QTY, existing.quantity + quantity), existing.id);
  } else {
    d.prepare("INSERT INTO cart_items (cart_token, product_id, quantity, options) VALUES (?, ?, ?, ?)").run(
      token,
      productId,
      Math.min(MAX_QTY, quantity),
      key,
    );
  }
  d.prepare("UPDATE carts SET updated_at = datetime('now') WHERE token = ?").run(token);
  return { ok: true };
}

export function setQuantity(token: string, itemId: number, quantity: number, d: Db = db()): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    d.prepare("DELETE FROM cart_items WHERE id = ? AND cart_token = ?").run(itemId, token);
    return;
  }
  d.prepare("UPDATE cart_items SET quantity = ? WHERE id = ? AND cart_token = ?").run(Math.min(MAX_QTY, quantity), itemId, token);
}

export function removeItem(token: string, itemId: number, d: Db = db()): void {
  d.prepare("DELETE FROM cart_items WHERE id = ? AND cart_token = ?").run(itemId, token);
}

export function clearCart(token: string, d: Db = db()): void {
  d.prepare("DELETE FROM cart_items WHERE cart_token = ?").run(token);
}

export const MAX_ITEM_QUANTITY = MAX_QTY;
