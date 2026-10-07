import "server-only";
import type Database from "better-sqlite3";
import { db } from "../db";
import { decrypt, encrypt, encryptionPassphrase } from "../secrets";
import { parseQueries } from "./ebay-queries";
import { assertFetchableUrl } from "./net";
import { canonicalUrl, type FieldMap, type NormalizedItem } from "./parse";

type Db = Database.Database;

export type SourceKind = "feed_csv" | "feed_json" | "sitemap" | "links" | "ebay";
export const SOURCE_KINDS: { kind: SourceKind; label: string; help: string }[] = [
  { kind: "feed_csv", label: "Product feed (CSV)", help: "An official or affiliate feed. The most reliable source: prices, stock and images come straight from the shop." },
  { kind: "feed_json", label: "Product feed (JSON)", help: "The same, as JSON." },
  { kind: "sitemap", label: "Shop website (sitemap + product pages)", help: "Reads the shop's sitemap and the product data on each page. Only for shops whose terms and robots.txt allow it." },
  { kind: "ebay", label: "eBay (official API)", help: "Real UK listings with eBay's own photos, prices and links. Needs your free eBay developer keys (Admin > Integrations)." },
  { kind: "links", label: "Pasted product links", help: "Items added one by one from a link. Their prices are refreshed automatically." },
];

export type Source = {
  id: number;
  shopId: number;
  shopName: string;
  name: string;
  kind: SourceKind;
  /** The address with any query string (where feed keys live) removed, safe to show. */
  urlDisplay: string;
  fieldMap: FieldMap;
  termsUrl: string;
  termsNote: string;
  termsConfirmedAt: string | null;
  enabled: boolean;
  autoPublishNew: boolean;
  autoApplyUpdates: boolean;
  maxPriceChangePct: number;
  maxItems: number;
  delayMs: number;
  intervalHours: number;
  staleDays: number;
  defaultCategory: string;
  defaultWeightGrams: number;
  lastRunAt: string | null;
  lastStatus: string;
  lastMessage: string;
  pausedUntil: string | null;
  runningSince: string | null;
  createdAt: string;
  itemCount: number;
  pendingCount: number;
};

type SourceRow = {
  id: number; shop_id: number; shop_name: string; name: string; kind: SourceKind; url: string; field_map: string; terms_url: string; terms_note: string;
  terms_confirmed_at: string | null; enabled: number; auto_publish_new: number; auto_apply_updates: number; max_price_change_pct: number; max_items: number;
  delay_ms: number; interval_hours: number; stale_days: number; default_category: string; default_weight_grams: number; last_run_at: string | null;
  last_status: string; last_message: string; paused_until: string | null; running_since: string | null; created_at: string; item_count: number; pending_count: number;
};

const SOURCE_SQL = `
  SELECT c.*, s.name AS shop_name,
    (SELECT COUNT(*) FROM import_items i WHERE i.source_id = c.id) AS item_count,
    (SELECT COUNT(*) FROM import_items i WHERE i.source_id = c.id AND i.status IN ('PENDING','HELD')) AS pending_count
  FROM catalog_sources c JOIN shops s ON s.id = c.shop_id`;

function passphrase(): string {
  const p = encryptionPassphrase();
  if (!p) throw new Error("Set ADMIN_SECRET or SETTINGS_ENCRYPTION_KEY before saving feed addresses.");
  return p;
}

/** Feed addresses often carry an API key in the query string, so they are stored encrypted. */
function sealUrl(url: string): string {
  return url ? encrypt(url, passphrase()) : "";
}

export function sourceUrl(row: { url: string }): string {
  if (!row.url) return "";
  if (!row.url.startsWith("v1:")) return row.url;
  const p = encryptionPassphrase();
  return (p && decrypt(row.url, p)) || "";
}

export function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}${u.search ? "?…" : ""}`;
  } catch {
    return "";
  }
}

function toSource(r: SourceRow): Source {
  let map: FieldMap = {};
  try {
    map = JSON.parse(r.field_map) as FieldMap;
  } catch {
    /* keep empty */
  }
  return {
    id: r.id, shopId: r.shop_id, shopName: r.shop_name, name: r.name, kind: r.kind, urlDisplay: displayUrl(sourceUrl(r)), fieldMap: map,
    termsUrl: r.terms_url, termsNote: r.terms_note, termsConfirmedAt: r.terms_confirmed_at, enabled: r.enabled === 1,
    autoPublishNew: r.auto_publish_new === 1, autoApplyUpdates: r.auto_apply_updates === 1, maxPriceChangePct: r.max_price_change_pct,
    maxItems: r.max_items, delayMs: r.delay_ms, intervalHours: r.interval_hours, staleDays: r.stale_days, defaultCategory: r.default_category,
    defaultWeightGrams: r.default_weight_grams, lastRunAt: r.last_run_at, lastStatus: r.last_status, lastMessage: r.last_message,
    pausedUntil: r.paused_until, runningSince: r.running_since, createdAt: r.created_at, itemCount: r.item_count, pendingCount: r.pending_count,
  };
}

export function listSources(d: Db = db()): Source[] {
  return (d.prepare(`${SOURCE_SQL} ORDER BY c.id DESC`).all() as SourceRow[]).map(toSource);
}

export function getSource(id: number, d: Db = db()): Source | null {
  const r = d.prepare(`${SOURCE_SQL} WHERE c.id = ?`).get(id) as SourceRow | undefined;
  return r ? toSource(r) : null;
}

/** The real address, for the importer only. Never send this to a browser. */
export function getSourceUrl(id: number, d: Db = db()): string {
  const r = d.prepare("SELECT url FROM catalog_sources WHERE id = ?").get(id) as { url: string } | undefined;
  return r ? sourceUrl(r) : "";
}

export type SourceInput = {
  id: number; // 0 = create
  shopId: number;
  name: string;
  kind: SourceKind;
  /** Empty on edit keeps the saved address. */
  url: string;
  fieldMap: FieldMap;
  termsUrl: string;
  termsNote: string;
  confirmTerms: boolean;
  enabled: boolean;
  autoPublishNew: boolean;
  autoApplyUpdates: boolean;
  maxPriceChangePct: number;
  maxItems: number;
  delayMs: number;
  intervalHours: number;
  staleDays: number;
  defaultCategory: string;
  defaultWeightGrams: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)));

export function saveSource(i: SourceInput, d: Db = db()): { ok: true; id: number } | { ok: false; error: string } {
  if (!i.name.trim()) return { ok: false, error: "Give the source a name." };
  if (!SOURCE_KINDS.some((k) => k.kind === i.kind)) return { ok: false, error: "Choose a source type." };
  if (!d.prepare("SELECT 1 FROM shops WHERE id = ?").get(i.shopId)) return { ok: false, error: "Choose a shop." };
  if (i.url.trim()) {
    try {
      assertFetchableUrl(i.url.trim());
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "That address cannot be used." };
    }
  } else if (i.kind !== "links" && i.kind !== "ebay" && i.id === 0) {
    return { ok: false, error: "Enter the feed or sitemap address." };
  }
  if (i.kind === "ebay" && parseQueries(i.fieldMap.queries ?? "").length === 0) return { ok: false, error: "List at least one eBay search, one per line (for example: men's trainers)." };
  if (i.termsUrl.trim() && !/^https?:\/\//i.test(i.termsUrl.trim())) return { ok: false, error: "The terms link must start with http:// or https://" };
  if (i.enabled && !i.confirmTerms && !(i.id > 0 && getSource(i.id, d)?.termsConfirmedAt)) {
    return { ok: false, error: "Confirm that you have checked the shop's terms (or hold a licence for this feed) before switching the source on." };
  }
  const map = JSON.stringify(i.fieldMap ?? {});
  const row = {
    shopId: i.shopId, name: i.name.trim().slice(0, 80), kind: i.kind, fieldMap: map, termsUrl: i.termsUrl.trim().slice(0, 500),
    termsNote: i.termsNote.trim().slice(0, 500), enabled: i.enabled ? 1 : 0, autoPublishNew: i.autoPublishNew ? 1 : 0, autoApplyUpdates: i.autoApplyUpdates ? 1 : 0,
    maxPriceChangePct: clamp(i.maxPriceChangePct, 1, 90), maxItems: clamp(i.maxItems, 1, 500), delayMs: clamp(i.delayMs, 2000, 60000),
    intervalHours: clamp(i.intervalHours, 1, 168), staleDays: clamp(i.staleDays, 1, 90), defaultCategory: i.defaultCategory.trim().slice(0, 60),
    defaultWeightGrams: clamp(i.defaultWeightGrams, 1, 50000),
  };
  if (i.id > 0) {
    const existing = getSource(i.id, d);
    if (!existing) return { ok: false, error: "That source no longer exists." };
    d.prepare(
      `UPDATE catalog_sources SET shop_id=@shopId, name=@name, kind=@kind, field_map=@fieldMap, terms_url=@termsUrl, terms_note=@termsNote,
         enabled=@enabled, auto_publish_new=@autoPublishNew, auto_apply_updates=@autoApplyUpdates, max_price_change_pct=@maxPriceChangePct,
         max_items=@maxItems, delay_ms=@delayMs, interval_hours=@intervalHours, stale_days=@staleDays, default_category=@defaultCategory,
         default_weight_grams=@defaultWeightGrams WHERE id=@id`,
    ).run({ ...row, id: i.id });
    if (i.url.trim()) d.prepare("UPDATE catalog_sources SET url = ? WHERE id = ?").run(sealUrl(i.url.trim()), i.id);
    if (i.confirmTerms && !existing.termsConfirmedAt) d.prepare("UPDATE catalog_sources SET terms_confirmed_at = datetime('now') WHERE id = ?").run(i.id);
    return { ok: true, id: i.id };
  }
  const info = d
    .prepare(
      `INSERT INTO catalog_sources (shop_id, name, kind, url, field_map, terms_url, terms_note, terms_confirmed_at, enabled, auto_publish_new, auto_apply_updates,
         max_price_change_pct, max_items, delay_ms, interval_hours, stale_days, default_category, default_weight_grams)
       VALUES (@shopId, @name, @kind, @url, @fieldMap, @termsUrl, @termsNote, ${i.confirmTerms ? "datetime('now')" : "NULL"}, @enabled, @autoPublishNew, @autoApplyUpdates,
         @maxPriceChangePct, @maxItems, @delayMs, @intervalHours, @staleDays, @defaultCategory, @defaultWeightGrams)`,
    )
    .run({ ...row, url: sealUrl(i.url.trim()) });
  return { ok: true, id: Number(info.lastInsertRowid) };
}

export function setSourceEnabled(id: number, on: boolean, d: Db = db()): { ok: true } | { ok: false; error: string } {
  const s = getSource(id, d);
  if (!s) return { ok: false, error: "That source no longer exists." };
  if (on && !s.termsConfirmedAt) return { ok: false, error: "Confirm the shop's terms on the source before switching it on." };
  d.prepare("UPDATE catalog_sources SET enabled = ?, paused_until = CASE WHEN ? = 1 THEN NULL ELSE paused_until END WHERE id = ?").run(on ? 1 : 0, on ? 1 : 0, id);
  return { ok: true };
}

/** The per-shop source that holds items added from pasted links. */
export function linksSourceFor(shopId: number, d: Db = db()): number {
  const hit = d.prepare("SELECT id FROM catalog_sources WHERE shop_id = ? AND kind = 'links' ORDER BY id LIMIT 1").get(shopId) as { id: number } | undefined;
  if (hit) return hit.id;
  const info = d
    .prepare(
      `INSERT INTO catalog_sources (shop_id, name, kind, terms_note, terms_confirmed_at, enabled, auto_publish_new, max_items)
       VALUES (?, 'Pasted links', 'links', 'Each page is read once when you paste it, then re-checked for price. robots.txt is obeyed.', datetime('now'), 1, 1, 25)`,
    )
    .run(shopId);
  return Number(info.lastInsertRowid);
}

// ------------------------------------------------------------------ runs

export type RunRow = {
  id: number; sourceId: number; startedAt: string; finishedAt: string | null; status: string;
  fetched: number; created: number; updated: number; held: number; skipped: number; removed: number; message: string;
};

export function listRuns(sourceId: number, limit = 15, d: Db = db()): RunRow[] {
  return (d.prepare("SELECT * FROM import_runs WHERE source_id = ? ORDER BY id DESC LIMIT ?").all(sourceId, limit) as Record<string, unknown>[]).map((r) => ({
    id: r.id as number, sourceId: r.source_id as number, startedAt: r.started_at as string, finishedAt: r.finished_at as string | null, status: r.status as string,
    fetched: r.fetched as number, created: r.created as number, updated: r.updated as number, held: r.held as number, skipped: r.skipped as number,
    removed: r.removed as number, message: r.message as string,
  }));
}

// ------------------------------------------------------------------ queue

export type ImportItem = NormalizedItem & {
  id: number;
  sourceId: number;
  sourceName: string;
  shopId: number;
  shopName: string;
  status: "PENDING" | "PUBLISHED" | "HELD" | "REJECTED";
  holdReason: string;
  productId: number | null;
  productPriceMinor: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

type ItemRow = {
  id: number; source_id: number; external_id: string; product_url: string; name: string; brand: string; category: string; description: string;
  price_minor: number; compare_at_minor: number | null; image_url: string; in_stock: number; weight_grams: number | null; status: ImportItem["status"];
  hold_reason: string; product_id: number | null; first_seen_at: string; last_seen_at: string; source_name: string; shop_id: number; shop_name: string; product_price: number | null;
};

const ITEM_SQL = `
  SELECT i.*, c.name AS source_name, c.shop_id AS shop_id, s.name AS shop_name, p.price_minor AS product_price
  FROM import_items i JOIN catalog_sources c ON c.id = i.source_id JOIN shops s ON s.id = c.shop_id
  LEFT JOIN products p ON p.id = i.product_id`;

const toItem = (r: ItemRow): ImportItem => ({
  id: r.id, sourceId: r.source_id, sourceName: r.source_name, shopId: r.shop_id, shopName: r.shop_name, externalId: r.external_id, productUrl: r.product_url,
  name: r.name, brand: r.brand, category: r.category, description: r.description, priceMinor: r.price_minor, compareAtMinor: r.compare_at_minor,
  imageUrl: r.image_url, inStock: r.in_stock === 1, weightGrams: r.weight_grams, status: r.status, holdReason: r.hold_reason, productId: r.product_id,
  productPriceMinor: r.product_price, firstSeenAt: r.first_seen_at, lastSeenAt: r.last_seen_at,
});

export function listImportItems(
  f: { status?: ImportItem["status"] | "REVIEW"; sourceId?: number; limit?: number; offset?: number } = {}, d: Db = db(),
): { items: ImportItem[]; total: number } {
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.status === "REVIEW") where.push("i.status IN ('PENDING','HELD')");
  else if (f.status) { where.push("i.status = ?"); args.push(f.status); }
  if (f.sourceId) { where.push("i.source_id = ?"); args.push(f.sourceId); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (d.prepare(`SELECT COUNT(*) AS n FROM import_items i ${w}`).get(...args) as { n: number }).n;
  const rows = d.prepare(`${ITEM_SQL} ${w} ORDER BY (i.status = 'HELD') DESC, i.id DESC LIMIT ? OFFSET ?`).all(...args, f.limit ?? 50, f.offset ?? 0) as ItemRow[];
  return { items: rows.map(toItem), total };
}

export function reviewCount(d: Db = db()): number {
  return (d.prepare("SELECT COUNT(*) AS n FROM import_items WHERE status IN ('PENDING','HELD')").get() as { n: number }).n;
}

export function blockedSources(d: Db = db()): Source[] {
  return listSources(d).filter((s) => s.lastStatus === "BLOCKED" || s.lastStatus === "ERROR");
}

export function getImportItem(id: number, d: Db = db()): ImportItem | null {
  const r = d.prepare(`${ITEM_SQL} WHERE i.id = ?`).get(id) as ItemRow | undefined;
  return r ? toItem(r) : null;
}

/** Finds a product we already list for a pasted link, so the shopper can be sent straight to it. */
export function findListedProductByUrl(url: string, d: Db = db()): { slug: string; name: string } | null {
  const key = canonicalUrl(url);
  const hit = d
    .prepare(
      `SELECT p.slug, p.name FROM import_items i JOIN products p ON p.id = i.product_id
       WHERE p.active = 1 AND (i.external_id = @k OR i.product_url = @u) LIMIT 1`,
    )
    .get({ k: key, u: url }) as { slug: string; name: string } | undefined;
  if (hit) return hit;
  const direct = d.prepare("SELECT slug, name FROM products WHERE active = 1 AND source_url IN (?, ?) LIMIT 1").get(url, key) as { slug: string; name: string } | undefined;
  return direct ?? null;
}
