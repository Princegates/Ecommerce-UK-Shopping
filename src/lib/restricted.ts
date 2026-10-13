import type Database from "better-sqlite3";

/**
 * Goods the shop does not buy or ship. Muscle stimulators (TENS and EMS) and powered massage machines are battery-powered medical-type
 * devices: they fall under medical-device rules and the lithium-battery limits on air freight, so they are left out of the catalogue,
 * refused as link requests, and never published by an import.
 *
 * Matching is on the item's name and category only. A match is a refusal, so the patterns stay specific: a massage oil or a plain
 * wooden foot roller is not caught.
 */
const POWERED = "(?:electric|electronic|rechargeable|battery|cordless|heated|heating|vibrat\\w*|shiatsu|percussion|kneading|deep[- ]tissue|usb|infrared|air[- ]compression)";
const RULES: { label: string; test: (s: string) => boolean }[] = [
  {
    label: "muscle stimulator (TENS or EMS)",
    // TENS and EMS are only matched in capitals, so words like "tens" or "items" are safe
    test: (s) => /\b(TENS|EMS)\b/.test(s) || /\b(muscle|nerve|electrical|electronic) stimulat\w*|electro[- ]?(therapy|stimulat\w*)|physio(therapy)? (device|machine)/i.test(s),
  },
  {
    label: "powered massage device",
    test: (s) =>
      /\bmassag\w*[\s-]*(gun|machine|chair|device|stimulator)\b/i.test(s) ||
      /\bmassager\w*\s+(gun|machine|chair|device)\b/i.test(s) ||
      new RegExp(`\\b${POWERED}\\b[^.]{0,40}\\bmassag\\w*|\\bmassag\\w*[^.]{0,40}\\b${POWERED}\\b`, "i").test(s),
  },
];

/** Why an item is not sold, or null if it is fine. */
export function restrictedReason(...text: (string | null | undefined)[]): string | null {
  const s = text.filter(Boolean).join(" ");
  if (!s) return null;
  return RULES.find((r) => r.test(s))?.label ?? null;
}

/** The words in a shop link's path ("Foot-Massager-EMS/dp/B0…" becomes "Foot Massager EMS dp B0…"), so a link request can be checked before it is saved. */
export function linkWords(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname).replace(/[-_+/]+/g, " ");
  } catch {
    return "";
  }
}

/** Takes live items that are restricted off the site and out of carts, and marks their import record rejected so a feed cannot bring them back. */
export function delistRestricted(d: Database.Database): number {
  const rows = d.prepare("SELECT id, name, category FROM products WHERE active = 1").all() as { id: number; name: string; category: string }[];
  let n = 0;
  for (const r of rows) {
    const why = restrictedReason(r.name, r.category);
    if (!why) continue;
    n++;
    d.prepare("UPDATE products SET active = 0 WHERE id = ?").run(r.id);
    d.prepare("DELETE FROM cart_items WHERE product_id = ?").run(r.id);
    d.prepare("UPDATE import_items SET status = 'REJECTED', hold_reason = ? WHERE product_id = ?").run(`Restricted item: ${why}`, r.id);
  }
  return n;
}
