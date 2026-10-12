import type Database from "better-sqlite3";

/**
 * Listings that are not goods the shop can buy and ship: warranty and protection plans, insurance, gift wrapping, postage and handling
 * fees. Sellers on marketplaces list them as items, usually at a few pounds ("Worry-Free Purchase" is a 30-day returns promise for £1).
 */
const CERTAIN = /worry[- ]free (purchase|protection|plan|cover)|protection plan|extended warranty|accidental damage (cover|protection|plan)|care plan|service plan/i;
const LIKELY = /\b(warranty|insurance|gift ?wrap|postage|(shipping|delivery|handling) (fee|charge|upgrade))\b/i;

/** Sure enough to take a live item off the site by itself. */
export function isCertainAddOn(name: string): boolean {
  return CERTAIN.test(name);
}

/** Enough to hold a new item for a person to look at before it goes live. */
export function looksLikeAddOn(name: string): boolean {
  return CERTAIN.test(name) || LIKELY.test(name);
}

/** Takes items that are certainly add-ons off the site, out of carts, and marks their import record as rejected so a feed cannot bring them back. */
export function delistAddOns(d: Database.Database): number {
  const rows = d.prepare("SELECT id, name FROM products WHERE active = 1").all() as { id: number; name: string }[];
  const bad = rows.filter((r) => isCertainAddOn(r.name));
  for (const r of bad) {
    d.prepare("UPDATE products SET active = 0 WHERE id = ?").run(r.id);
    d.prepare("DELETE FROM cart_items WHERE product_id = ?").run(r.id);
    d.prepare("UPDATE import_items SET status = 'REJECTED', hold_reason = '' WHERE product_id = ?").run(r.id);
  }
  return bad.length;
}
