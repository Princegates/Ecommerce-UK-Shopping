import "server-only";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { upsertProduct } from "../admin";
import { appUrl } from "../app-url";
import { db } from "../db";
import {
  BlockedError, HttpError, RobotsCache, UnsafeUrlError, assertFetchableUrl, bodyText, politeFetch, type PoliteDeps,
} from "./net";
import {
  canonicalUrl, csvToRecords, extractPageProduct, jsonToRecords, mapRecord, parseSitemap, type FieldMap, type NormalizedItem,
} from "./parse";
import { getSource, getSourceUrl, linksSourceFor, type ImportItem, type Source, type SourceKind } from "./store";

type Db = Database.Database;

export type IngestDeps = PoliteDeps & { now?: () => number };

const sqlTime = (ms: number) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);
const fmtGbp = (minor: number) => `£${(minor / 100).toFixed(2)}`;

function deps(d?: IngestDeps): PoliteDeps & { now: () => number } {
  return { ...d, now: d?.now ?? Date.now, appUrl: d?.appUrl ?? appUrl() };
}

// ------------------------------------------------------------------ rules for what may go live by itself

const MIN_PRICE = 50; // 50p
const MAX_PRICE = 1_000_000; // £10,000

/** Cheap sanity checks. An item that fails goes to review instead of straight onto the site. */
export function sanityProblem(it: NormalizedItem): string | null {
  if (it.priceMinor < MIN_PRICE) return `Price ${fmtGbp(it.priceMinor)} looks too low`;
  if (it.priceMinor > MAX_PRICE) return `Price ${fmtGbp(it.priceMinor)} looks too high`;
  if (it.name.length < 3) return "Name is too short";
  if (!it.productUrl) return "No link back to the shop";
  return null;
}

function fingerprint(it: NormalizedItem): string {
  return createHash("sha1").update(JSON.stringify([it.priceMinor, it.compareAtMinor, it.inStock, it.imageUrl])).digest("hex");
}

// ------------------------------------------------------------------ publishing

type ItemRow = {
  id: number; source_id: number; external_id: string; product_url: string; name: string; brand: string; category: string; description: string;
  price_minor: number; compare_at_minor: number | null; image_url: string; in_stock: number; weight_grams: number | null; fingerprint: string;
  status: ImportItem["status"]; hold_reason: string; product_id: number | null;
};

function applyToProduct(d: Db, productId: number, it: ItemRow, reactivate: boolean, nowStr: string): void {
  const p = d.prepare("SELECT image_url, compare_at_minor FROM products WHERE id = ?").get(productId) as { image_url: string | null; compare_at_minor: number | null } | undefined;
  if (!p) return;
  const compare = it.compare_at_minor && it.compare_at_minor > it.price_minor ? it.compare_at_minor : null;
  d.prepare(
    `UPDATE products SET price_minor = @price, compare_at_minor = @compare,
       deal_ends_at = CASE WHEN @compare IS NULL THEN NULL ELSE deal_ends_at END,
       image_url = CASE WHEN COALESCE(image_url, '') = '' AND @image <> '' THEN @image ELSE image_url END,
       active = CASE WHEN @reactivate = 1 THEN @inStock ELSE active END,
       last_synced_at = @now WHERE id = @id`,
  ).run({ id: productId, price: it.price_minor, compare, image: it.image_url, reactivate: reactivate ? 1 : 0, inStock: it.in_stock, now: nowStr });
}

/** Puts an item on the site (creating the product) or applies its latest price and stock to the product it already feeds. */
export function publishItem(itemId: number, d: Db = db(), now = Date.now()): { ok: true; productId: number } | { ok: false; error: string } {
  const it = d.prepare("SELECT * FROM import_items WHERE id = ?").get(itemId) as ItemRow | undefined;
  if (!it) return { ok: false, error: "That item no longer exists." };
  const src = d.prepare("SELECT c.shop_id, c.default_category, c.default_weight_grams, s.category AS shop_category FROM catalog_sources c JOIN shops s ON s.id = c.shop_id WHERE c.id = ?").get(it.source_id) as
    | { shop_id: number; default_category: string; default_weight_grams: number; shop_category: string }
    | undefined;
  if (!src) return { ok: false, error: "The source for that item was removed." };
  const nowStr = sqlTime(now);
  const exists = it.product_id ? d.prepare("SELECT 1 FROM products WHERE id = ?").get(it.product_id) : null;
  let productId = it.product_id ?? 0;
  if (exists) {
    applyToProduct(d, productId, it, true, nowStr);
  } else {
    productId = upsertProduct(
      {
        id: 0, shopId: src.shop_id, name: it.name, brand: it.brand, category: it.category || src.default_category || src.shop_category, description: it.description,
        priceMinor: it.price_minor, weightGrams: it.weight_grams ?? src.default_weight_grams, options: [], imageUrl: it.image_url, sourceUrl: it.product_url,
        active: it.in_stock === 1, compareAtMinor: it.compare_at_minor && it.compare_at_minor > it.price_minor ? it.compare_at_minor : null, dealEndsAt: null,
      },
      d,
    );
    d.prepare("UPDATE products SET last_synced_at = ? WHERE id = ?").run(nowStr, productId);
  }
  d.prepare("UPDATE import_items SET status = 'PUBLISHED', product_id = ?, hold_reason = '' WHERE id = ?").run(productId, itemId);
  return { ok: true, productId };
}

export function rejectItem(itemId: number, d: Db = db()): boolean {
  return d.prepare("UPDATE import_items SET status = 'REJECTED', hold_reason = '' WHERE id = ?").run(itemId).changes > 0;
}

// ------------------------------------------------------------------ staging one item

type Counters = { fetched: number; created: number; updated: number; held: number; skipped: number; removed: number };
const zero = (): Counters => ({ fetched: 0, created: 0, updated: 0, held: 0, skipped: 0, removed: 0 });

export function stageItem(d: Db, source: Source, it: NormalizedItem, runStart: string, now: number, c: Counters): number {
  const fp = fingerprint(it);
  const existing = d.prepare("SELECT * FROM import_items WHERE source_id = ? AND external_id = ?").get(source.id, it.externalId) as ItemRow | undefined;
  const fields = {
    url: it.productUrl, name: it.name, brand: it.brand, category: it.category, description: it.description, price: it.priceMinor,
    compare: it.compareAtMinor, image: it.imageUrl, stock: it.inStock ? 1 : 0, weight: it.weightGrams, fp, seen: runStart,
  };

  if (!existing) {
    const info = d
      .prepare(
        `INSERT INTO import_items (source_id, external_id, product_url, name, brand, category, description, price_minor, compare_at_minor, image_url, in_stock, weight_grams, fingerprint, first_seen_at, last_seen_at)
         VALUES (@source, @ext, @url, @name, @brand, @category, @description, @price, @compare, @image, @stock, @weight, @fp, @seen, @seen)`,
      )
      .run({ ...fields, source: source.id, ext: it.externalId });
    const id = Number(info.lastInsertRowid);
    c.created++;
    const problem = sanityProblem(it);
    if (source.autoPublishNew && !problem) publishItem(id, d, now);
    else if (problem) d.prepare("UPDATE import_items SET hold_reason = ? WHERE id = ?").run(`Needs a look: ${problem}`, id);
    return id;
  }

  const touch = () => d.prepare("UPDATE import_items SET last_seen_at = ? WHERE id = ?").run(runStart, existing.id);
  const savedProductId = existing.product_id && d.prepare("SELECT 1 FROM products WHERE id = ?").get(existing.product_id) ? existing.product_id : null;
  const nowStr = sqlTime(now);

  // not live: refresh what we show in the queue, never change the decision
  if (existing.status !== "PUBLISHED" && existing.status !== "HELD") {
    d.prepare(
      `UPDATE import_items SET product_url=@url, name=@name, brand=@brand, category=@category, description=@description, price_minor=@price, compare_at_minor=@compare,
         image_url=@image, in_stock=@stock, weight_grams=@weight, fingerprint=@fp, last_seen_at=@seen WHERE id=@id`,
    ).run({ ...fields, id: existing.id });
    return existing.id;
  }

  // published item whose product was deleted: treat it as new
  if (existing.status === "PUBLISHED" && !savedProductId) {
    d.prepare("UPDATE import_items SET status = 'PENDING', product_id = NULL WHERE id = ?").run(existing.id);
    d.prepare("UPDATE import_items SET price_minor=?, compare_at_minor=?, in_stock=?, image_url=?, fingerprint=?, last_seen_at=? WHERE id=?").run(it.priceMinor, it.compareAtMinor, fields.stock, it.imageUrl, fp, runStart, existing.id);
    if (source.autoPublishNew && !sanityProblem(it)) publishItem(existing.id, d, now);
    return existing.id;
  }

  if (existing.fingerprint === fp && existing.status === "PUBLISHED") {
    touch();
    if (savedProductId) d.prepare("UPDATE products SET last_synced_at = ? WHERE id = ?").run(nowStr, savedProductId);
    return existing.id;
  }

  // a published (or held) item changed: decide whether it may update the live product by itself
  const productPrice = savedProductId ? (d.prepare("SELECT price_minor FROM products WHERE id = ?").get(savedProductId) as { price_minor: number }).price_minor : existing.price_minor;
  const changePct = productPrice > 0 ? (Math.abs(it.priceMinor - productPrice) / productPrice) * 100 : 100;
  const problem = sanityProblem(it);
  let hold = "";
  if (problem) hold = `Needs a look: ${problem}`;
  else if (!source.autoApplyUpdates) hold = `Update waiting for approval: ${fmtGbp(productPrice)} to ${fmtGbp(it.priceMinor)}`;
  else if (changePct > source.maxPriceChangePct) hold = `Price moved ${changePct.toFixed(0)}% (${fmtGbp(productPrice)} to ${fmtGbp(it.priceMinor)}); check it is right`;

  const prevInStock = existing.in_stock === 1;
  d.prepare(
    `UPDATE import_items SET product_url=@url, name=@name, brand=@brand, category=@category, description=@description, price_minor=@price, compare_at_minor=@compare,
       image_url=@image, in_stock=@stock, weight_grams=@weight, fingerprint=@fp, last_seen_at=@seen WHERE id=@id`,
  ).run({ ...fields, id: existing.id });

  if (hold) {
    d.prepare("UPDATE import_items SET status = 'HELD', hold_reason = ? WHERE id = ?").run(hold, existing.id);
    c.held++;
    return existing.id;
  }
  const row = d.prepare("SELECT * FROM import_items WHERE id = ?").get(existing.id) as ItemRow;
  applyToProduct(d, savedProductId!, row, existing.fingerprint === "" || prevInStock !== it.inStock, nowStr);
  d.prepare("UPDATE import_items SET status = 'PUBLISHED', hold_reason = '' WHERE id = ?").run(existing.id);
  c.updated++;
  return existing.id;
}

// ------------------------------------------------------------------ fetching items from each kind of source

type Gathered = { items: NormalizedItem[]; skips: Map<string, number>; complete: boolean; blocked?: string };

function addSkip(m: Map<string, number>, why: string) {
  m.set(why, (m.get(why) ?? 0) + 1);
}

const FEED_ROW_LIMIT = 20_000;

async function gatherFeed(kind: SourceKind, url: string, map: FieldMap, dp: PoliteDeps): Promise<Gathered> {
  const { res } = await politeFetch(url, dp, {
    maxBytes: 40_000_000, timeoutMs: 90_000, accept: kind === "feed_json" ? "application/json,*/*;q=0.5" : "text/csv,text/plain,*/*;q=0.5",
  });
  if (res.truncated) throw new Error("The feed is larger than the 40 MB limit.");
  const text = bodyText(res, 120_000_000);
  const records = (kind === "feed_json" ? jsonToRecords(text) : csvToRecords(text)).slice(0, FEED_ROW_LIMIT);
  if (records.length === 0) throw new Error("The feed had no rows we could read. Check the address and format.");
  const skips = new Map<string, number>();
  const seen = new Set<string>();
  const items: NormalizedItem[] = [];
  for (const r of records) {
    const m = mapRecord(r, map);
    if ("skip" in m) { addSkip(skips, m.skip); continue; }
    if (seen.has(m.item.externalId)) { addSkip(skips, "duplicate id"); continue; }
    seen.add(m.item.externalId);
    items.push(m.item);
  }
  return { items, skips, complete: true };
}

function sameSite(candidate: string, root: string): boolean {
  try {
    const a = new URL(candidate).hostname;
    const b = new URL(root).hostname.replace(/^www\./, "");
    return a === new URL(root).hostname || a.replace(/^www\./, "") === b || a.endsWith(`.${b}`);
  } catch {
    return false;
  }
}

async function collectSitemapUrls(root: string, map: FieldMap, dp: PoliteDeps): Promise<string[]> {
  const queue = [root];
  const seenMaps = new Set<string>();
  const pages: string[] = [];
  const include = (map.include ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const exclude = (map.exclude ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  while (queue.length && seenMaps.size < 25 && pages.length < 20_000) {
    const next = queue.shift()!;
    if (seenMaps.has(next)) continue;
    seenMaps.add(next);
    const { res } = await politeFetch(next, dp, { maxBytes: 30_000_000, timeoutMs: 60_000, delayMs: 1500, accept: "application/xml,text/xml,*/*;q=0.5" });
    const { urls, sitemaps } = parseSitemap(bodyText(res, 120_000_000));
    for (const s of sitemaps) if (sameSite(s, root)) queue.push(s);
    for (const u of urls) {
      if (!sameSite(u, root)) continue;
      if (include.length && !include.some((x) => u.includes(x))) continue;
      if (exclude.some((x) => u.includes(x))) continue;
      pages.push(u);
    }
  }
  return pages;
}

/** Reads product pages one at a time, politely. Stops the moment a shop refuses. */
async function crawlPages(source: Source, urls: string[], dp: PoliteDeps, robots: RobotsCache, onMissing?: (url: string) => void): Promise<Gathered> {
  const items: NormalizedItem[] = [];
  const skips = new Map<string, number>();
  for (const u of urls) {
    let target: URL;
    try {
      target = assertFetchableUrl(u);
    } catch {
      addSkip(skips, "unsafe address");
      continue;
    }
    const rule = await robots.allowed(target);
    if (!rule.ok) { addSkip(skips, "disallowed by robots.txt"); continue; }
    try {
      const { res, finalUrl } = await politeFetch(u, dp, { delayMs: Math.max(source.delayMs, (rule.delaySeconds ?? 0) * 1000), maxBytes: 3_000_000 });
      const parsed = extractPageProduct(bodyText(res, 8_000_000), finalUrl);
      if ("skip" in parsed) { addSkip(skips, parsed.skip); continue; }
      // keep the address we were given as the key so a re-check updates the same item
      items.push({ ...parsed.item, externalId: canonicalUrl(u), productUrl: parsed.item.productUrl || u });
    } catch (e) {
      if (e instanceof BlockedError) return { items, skips, complete: false, blocked: e.message };
      if (e instanceof HttpError && (e.status === 404 || e.status === 410)) { onMissing?.(u); addSkip(skips, "page gone"); continue; }
      if (e instanceof UnsafeUrlError) { addSkip(skips, "unsafe address"); continue; }
      addSkip(skips, "could not be read");
    }
  }
  return { items, skips, complete: false };
}

function summarise(skips: Map<string, number>): string {
  const top = [...skips.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return top.map(([why, n]) => `${n} skipped: ${why}`).join("; ");
}

// ------------------------------------------------------------------ running a source

export type RunResult = { status: "OK" | "BLOCKED" | "ERROR" | "SKIPPED"; message: string } & Counters;

function finishSource(d: Db, id: number, runId: number | null, status: string, message: string, c: Counters, pauseHours = 0, now = Date.now()) {
  const msg = message.slice(0, 400);
  if (runId) {
    d.prepare("UPDATE import_runs SET finished_at = ?, status = ?, fetched = ?, created = ?, updated = ?, held = ?, skipped = ?, removed = ?, message = ? WHERE id = ?")
      .run(sqlTime(now), status, c.fetched, c.created, c.updated, c.held, c.skipped, c.removed, msg, runId);
  }
  d.prepare(
    `UPDATE catalog_sources SET last_run_at = ?, last_status = ?, last_message = ?, running_since = NULL,
       paused_until = ${pauseHours > 0 ? "?" : "paused_until"} WHERE id = ?`,
  ).run(...([sqlTime(now), status, msg, ...(pauseHours > 0 ? [sqlTime(now + pauseHours * 3_600_000)] : []), id] as unknown[]));
}

const LOCK_MINUTES = 30;

export async function runSource(id: number, o: IngestDeps = {}, d: Db = db(), opts: { scheduled?: boolean } = {}): Promise<RunResult> {
  const dp = deps(o);
  const now = dp.now();
  const skipped = (message: string): RunResult => ({ status: "SKIPPED", message, ...zero() });
  const source = getSource(id, d);
  if (!source) return { status: "ERROR", message: "That source no longer exists.", ...zero() };
  if (!source.termsConfirmedAt) return skipped("Confirm the shop's terms on this source before it can run.");
  if (opts.scheduled && !source.enabled) return skipped("The source is switched off.");
  if (source.pausedUntil && source.pausedUntil > sqlTime(now)) return skipped(`Paused until ${source.pausedUntil} UTC after the shop refused access.`);
  if (source.runningSince && source.runningSince > sqlTime(now - LOCK_MINUTES * 60_000)) return skipped("A run is already in progress.");

  const runStart = sqlTime(now);
  d.prepare("UPDATE catalog_sources SET running_since = ? WHERE id = ?").run(runStart, id);
  const run = d.prepare("INSERT INTO import_runs (source_id, started_at) VALUES (?, ?)").run(id, runStart);
  const runId = Number(run.lastInsertRowid);
  const c = zero();

  try {
    const url = getSourceUrl(id, d);
    let gathered: Gathered;

    if (source.kind === "feed_csv" || source.kind === "feed_json") {
      if (!url) throw new Error("This source has no feed address.");
      gathered = await gatherFeed(source.kind, url, source.fieldMap, dp);
    } else {
      const robots = new RobotsCache(dp);
      let urls: string[];
      if (source.kind === "sitemap") {
        if (!url) throw new Error("This source has no sitemap address.");
        urls = await collectSitemapUrls(url, source.fieldMap, dp);
        if (urls.length === 0) throw new Error("The sitemap listed no product pages (check the address and the include filter).");
        const known = new Map((d.prepare("SELECT external_id, last_seen_at FROM import_items WHERE source_id = ?").all(id) as { external_id: string; last_seen_at: string }[]).map((r) => [r.external_id, r.last_seen_at]));
        const fresh = urls.filter((u) => !known.has(canonicalUrl(u)));
        const old = urls.filter((u) => known.has(canonicalUrl(u))).sort((a, b) => (known.get(canonicalUrl(a)) ?? "").localeCompare(known.get(canonicalUrl(b)) ?? ""));
        urls = [...fresh, ...old].slice(0, source.maxItems);
      } else {
        urls = (d.prepare("SELECT product_url FROM import_items WHERE source_id = ? AND status <> 'REJECTED' AND product_url <> '' ORDER BY last_seen_at ASC LIMIT ?").all(id, source.maxItems) as { product_url: string }[]).map((r) => r.product_url);
      }
      gathered = await crawlPages(source, urls, dp, robots, (missing) => {
        const row = d.prepare("SELECT id, product_id FROM import_items WHERE source_id = ? AND external_id = ?").get(id, canonicalUrl(missing)) as { id: number; product_id: number | null } | undefined;
        if (row?.product_id) {
          d.prepare("UPDATE products SET active = 0 WHERE id = ?").run(row.product_id);
          d.prepare("UPDATE import_items SET in_stock = 0, fingerprint = '' WHERE id = ?").run(row.id);
          c.removed++;
        }
      });
    }

    c.fetched = gathered.items.length;
    c.skipped = [...gathered.skips.values()].reduce((a, b) => a + b, 0);
    const seenIds = new Set<number>();
    const tx = d.transaction(() => {
      for (const it of gathered.items) seenIds.add(stageItem(d, source, it, runStart, now, c));
    });
    tx();

    const notes: string[] = [];
    if (gathered.complete && gathered.items.length > 0) {
      const live = d.prepare("SELECT id, product_id FROM import_items WHERE source_id = ? AND status = 'PUBLISHED'").all(id) as { id: number; product_id: number | null }[];
      const gone = live.filter((g) => !seenIds.has(g.id));
      const total = (d.prepare("SELECT COUNT(*) AS n FROM import_items WHERE source_id = ?").get(id) as { n: number }).n;
      if (gone.length > 0 && seenIds.size >= total * 0.5) {
        for (const g of gone) {
          if (g.product_id) d.prepare("UPDATE products SET active = 0 WHERE id = ?").run(g.product_id);
          d.prepare("UPDATE import_items SET in_stock = 0, fingerprint = '' WHERE id = ?").run(g.id);
          c.removed++;
        }
      } else if (gone.length > 0) {
        notes.push(`${gone.length} listed items were missing, but the feed is much smaller than before, so nothing was removed`);
      }
    }

    const skipNote = summarise(gathered.skips);
    if (gathered.blocked) {
      const msg = `${gathered.blocked} Stopped. Use the shop's official feed or add items by hand; this tool does not work around blocks. Paused for 24 hours.`;
      finishSource(d, id, runId, "BLOCKED", msg, c, 24, now);
      return { status: "BLOCKED", message: msg, ...c };
    }
    const message = [`${c.fetched} read, ${c.created} new, ${c.updated} updated, ${c.held} held for review, ${c.removed} removed`, skipNote, ...notes].filter(Boolean).join(". ");
    finishSource(d, id, runId, "OK", message, c, 0, now);
    return { status: "OK", message, ...c };
  } catch (e) {
    const blocked = e instanceof BlockedError;
    const message = blocked
      ? `${e.message} Stopped. Use the shop's official feed or add items by hand; this tool does not work around blocks. Paused for 24 hours.`
      : e instanceof Error ? e.message : "The run failed.";
    finishSource(d, id, runId, blocked ? "BLOCKED" : "ERROR", message, c, blocked ? 24 : 0, now);
    return { status: blocked ? "BLOCKED" : "ERROR", message, ...c };
  }
}

// ------------------------------------------------------------------ keeping things fresh

/** Hides imported products that have not been seen for longer than their source allows. */
export function sweepStale(d: Db = db(), now = Date.now()): number {
  const cutoff = sqlTime(now);
  const rows = d
    .prepare(
      `SELECT i.id AS item_id, i.product_id FROM import_items i JOIN catalog_sources c ON c.id = i.source_id JOIN products p ON p.id = i.product_id
       WHERE i.status = 'PUBLISHED' AND p.active = 1
         AND julianday(?) - julianday(COALESCE(p.last_synced_at, i.last_seen_at)) > c.stale_days`,
    )
    .all(cutoff) as { item_id: number; product_id: number }[];
  for (const r of rows) {
    d.prepare("UPDATE products SET active = 0 WHERE id = ?").run(r.product_id);
    d.prepare("UPDATE import_items SET fingerprint = '' WHERE id = ?").run(r.item_id);
  }
  return rows.length;
}

/** Runs every source that is switched on and due. Safe to call often. */
export async function runDueSources(o: IngestDeps = {}, d: Db = db()): Promise<{ ran: { id: number; name: string; status: string; message: string }[]; hidden: number }> {
  const now = (o.now ?? Date.now)();
  const due = (d
    .prepare("SELECT id, name, interval_hours, last_run_at FROM catalog_sources WHERE enabled = 1 AND terms_confirmed_at IS NOT NULL ORDER BY COALESCE(last_run_at, '') ASC")
    .all() as { id: number; name: string; interval_hours: number; last_run_at: string | null }[]).filter(
    (s) => !s.last_run_at || new Date(`${s.last_run_at.replace(" ", "T")}Z`).getTime() + s.interval_hours * 3_600_000 <= now,
  );
  const ran: { id: number; name: string; status: string; message: string }[] = [];
  for (const s of due) {
    const r = await runSource(s.id, o, d, { scheduled: true });
    if (r.status !== "SKIPPED") ran.push({ id: s.id, name: s.name, status: r.status, message: r.message });
  }
  return { ran, hidden: sweepStale(d, now) };
}

// ------------------------------------------------------------------ pasted links

export type LinkResult = {
  url: string;
  status: "added" | "updated" | "exists" | "robots" | "blocked" | "no-data" | "wrong-currency" | "unsafe" | "error";
  message: string;
  name?: string;
  priceMinor?: number;
  productId?: number | null;
};

/** Reads each pasted product link once (obeying robots.txt) and puts the item in the shop's "Pasted links" source. */
export async function importLinks(urls: string[], o: { shopId: number }, ioDeps: IngestDeps = {}, d: Db = db()): Promise<LinkResult[]> {
  const dp = deps(ioDeps);
  const now = dp.now();
  const runStart = sqlTime(now);
  const sourceId = linksSourceFor(o.shopId, d);
  const source = getSource(sourceId, d)!;
  const robots = new RobotsCache(dp);
  const out: LinkResult[] = [];
  const list = [...new Set(urls.map((u) => u.trim()).filter(Boolean))].slice(0, 20);
  for (const raw of list) {
    let target: URL;
    try {
      target = assertFetchableUrl(raw);
    } catch (e) {
      out.push({ url: raw, status: "unsafe", message: e instanceof Error ? e.message : "That address cannot be read." });
      continue;
    }
    if (!(await robots.allowed(target)).ok) {
      out.push({ url: raw, status: "robots", message: "The shop's robots.txt does not allow automated reading of this page. Add the item by hand instead." });
      continue;
    }
    try {
      const rule = await robots.allowed(target);
      const { res, finalUrl } = await politeFetch(raw, dp, { delayMs: Math.max(source.delayMs, (rule.delaySeconds ?? 0) * 1000) });
      const parsed = extractPageProduct(bodyText(res, 8_000_000), finalUrl);
      if ("skip" in parsed) {
        out.push({ url: raw, status: /not GBP/.test(parsed.skip) ? "wrong-currency" : "no-data", message: parsed.skip.charAt(0).toUpperCase() + parsed.skip.slice(1) + "." });
        continue;
      }
      const item: NormalizedItem = { ...parsed.item, externalId: canonicalUrl(raw), productUrl: parsed.item.productUrl || raw };
      const before = d.prepare("SELECT id, status FROM import_items WHERE source_id = ? AND external_id = ?").get(sourceId, item.externalId) as { id: number; status: string } | undefined;
      const c = zero();
      const id = stageItem(d, source, item, runStart, now, c);
      const row = d.prepare("SELECT status, product_id, hold_reason FROM import_items WHERE id = ?").get(id) as { status: string; product_id: number | null; hold_reason: string };
      out.push({
        url: raw, name: item.name, priceMinor: item.priceMinor, productId: row.product_id,
        status: before ? (c.updated ? "updated" : "exists") : "added",
        message: row.status === "PUBLISHED" ? "Live on the site." : row.hold_reason || "Waiting in the review queue.",
      });
    } catch (e) {
      if (e instanceof BlockedError) out.push({ url: raw, status: "blocked", message: `${e.message} Add this item by hand instead.` });
      else out.push({ url: raw, status: "error", message: e instanceof Error ? e.message : "Could not read that page." });
    }
  }
  return out;
}

/** A read-only look at one link for the "request an item" form. Saves nothing. */
export async function lookupLink(raw: string, ioDeps: IngestDeps = {}): Promise<{ ok: true; item: NormalizedItem } | { ok: false; reason: string }> {
  const dp = deps(ioDeps);
  let target: URL;
  try {
    target = assertFetchableUrl(raw.trim());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const robots = new RobotsCache(dp);
  if (!(await robots.allowed(target)).ok) return { ok: false, reason: "robots" };
  try {
    const { res, finalUrl } = await politeFetch(target.toString(), dp, { maxBytes: 2_000_000, timeoutMs: 10_000 });
    const parsed = extractPageProduct(bodyText(res, 6_000_000), finalUrl);
    return "item" in parsed ? { ok: true, item: parsed.item } : { ok: false, reason: "no-data" };
  } catch (e) {
    return { ok: false, reason: e instanceof BlockedError ? "blocked" : "error" };
  }
}

// ------------------------------------------------------------------ dry run

export type Preview = { ok: boolean; message: string; sample: NormalizedItem[]; skipNote: string; totalRows?: number };

/** Fetches and parses a little, without saving anything, so a setup can be checked before it is switched on. */
export async function previewSource(
  i: { kind: SourceKind; url: string; fieldMap: FieldMap },
  ioDeps: IngestDeps = {},
): Promise<Preview> {
  const dp = deps(ioDeps);
  try {
    assertFetchableUrl(i.url);
    if (i.kind === "feed_csv" || i.kind === "feed_json") {
      const g = await gatherFeed(i.kind, i.url, i.fieldMap, dp);
      return { ok: true, message: `Read ${g.items.length} usable item${g.items.length === 1 ? "" : "s"}.`, sample: g.items.slice(0, 5), skipNote: summarise(g.skips), totalRows: g.items.length };
    }
    if (i.kind === "sitemap") {
      const urls = await collectSitemapUrls(i.url, i.fieldMap, dp);
      if (urls.length === 0) return { ok: false, message: "The sitemap listed no product pages. Check the address and the include filter.", sample: [], skipNote: "" };
      const g = await crawlPages({ delayMs: 2000 } as Source, urls.slice(0, 3), dp, new RobotsCache(dp));
      const note = g.blocked ?? summarise(g.skips);
      return { ok: g.items.length > 0, message: g.items.length ? `Found ${urls.length} pages. Read ${g.items.length} of the first ${Math.min(3, urls.length)}.` : `Found ${urls.length} pages but could not read product data from the first ones.`, sample: g.items, skipNote: note, totalRows: urls.length };
    }
    return { ok: false, message: "Nothing to preview for pasted links.", sample: [], skipNote: "" };
  } catch (e) {
    return { ok: false, message: e instanceof BlockedError ? `${e.message} Use the shop's official feed instead.` : e instanceof Error ? e.message : "The preview failed.", sample: [], skipNote: "" };
  }
}
