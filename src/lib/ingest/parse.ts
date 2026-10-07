/** Pure parsing helpers for catalogue feeds and product pages. Nothing here touches the network or the database. */

export type NormalizedItem = {
  externalId: string;
  productUrl: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  priceMinor: number;
  compareAtMinor: number | null;
  imageUrl: string;
  inStock: boolean;
  weightGrams: number | null;
  /** choices the shopper picks (size, colour); only set by sources that know them */
  options?: { name: string; values: string[] }[];
};

export type ParseResult = { item: NormalizedItem } | { skip: string };

// ------------------------------------------------------------------ money

const CURRENCY_CODES = new Set(["GBP", "USD", "EUR", "CAD", "AUD", "NZD", "JPY", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "INR", "CNY", "HKD", "SGD", "ZAR", "NGN", "GHS", "AED", "TRY"]);
const SYMBOL_CURRENCY: Record<string, string> = { "£": "GBP", "$": "USD", "€": "EUR" };

/**
 * Reads "£12.99", "12.99 GBP", "1,299.00", "12,99" or the number 12.99 into pence.
 * `currency` is null when the text names none; callers decide whether that is acceptable.
 */
export function parsePrice(input: unknown): { minor: number; currency: string | null } | null {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0 || input > 1_000_000) return null;
    return { minor: Math.round(input * 100), currency: null };
  }
  if (typeof input !== "string") return null;
  const text = input.trim();
  if (!text) return null;
  let currency: string | null = null;
  const code = /\b([A-Za-z]{3})\b/.exec(text.replace(/[\d.,\s]/g, " "));
  if (code && CURRENCY_CODES.has(code[1].toUpperCase())) currency = code[1].toUpperCase();
  for (const [sym, cur] of Object.entries(SYMBOL_CURRENCY)) if (text.includes(sym)) currency = currency ?? cur;
  const numeric = text.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(numeric) || numeric.includes("-")) return null;
  const lastDot = numeric.lastIndexOf(".");
  const lastComma = numeric.lastIndexOf(",");
  let normalized: string;
  if (lastComma > lastDot) {
    // 12,99 or 1.299,00: the comma is the decimal mark when two digits follow it
    const after = numeric.length - lastComma - 1;
    normalized = after === 2 || after === 1 ? numeric.replace(/\./g, "").replace(",", ".") : numeric.replace(/,/g, "");
  } else {
    normalized = numeric.replace(/,/g, "");
  }
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
  return { minor: Math.round(n * 100), currency };
}

// ------------------------------------------------------------------ text

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", pound: "£" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function cleanText(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Page titles often end with the shop's own name and department ("Echo Dot : Amazon.co.uk: Amazon Devices"). Drops that
 * tail, and shortens a long title at a word boundary instead of in the middle of a word.
 */
export function tidyTitle(raw: string, max = 160): string {
  let t = raw.replace(/\s*[:|\-–—]\s*Amazon\.[a-z.]+\b.*$/i, "").replace(/^Amazon\.[a-z.]+\s*[:|\-–—]\s*/i, "").trim();
  if (t.length > max) {
    const cut = t.slice(0, max);
    t = (cut.includes(" ") ? cut.slice(0, cut.lastIndexOf(" ")) : cut).replace(/[\s,;:|\-–—]+$/, "") + "…";
  }
  return t;
}

/** Only absolute http(s) addresses survive; anything else becomes empty. */
export function cleanUrl(s: unknown, base?: string): string {
  if (typeof s !== "string" || !s.trim()) return "";
  try {
    const u = new URL(s.trim(), base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    u.hash = "";
    return u.toString().slice(0, 1000);
  } catch {
    return "";
  }
}

/** A stable key for a product page: no fragment and no tracking parameters. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|gclid|fbclid|msclkid|mc_|ref$|cmpid|affid|awc$|clickref)/i.test(k)) u.searchParams.delete(k);
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

function lastSegment(category: string): string {
  const parts = category.split(/\s*[>/|]\s*/).filter(Boolean);
  return (parts[parts.length - 1] ?? "").slice(0, 60);
}

// ------------------------------------------------------------------ CSV

export function detectDelimiter(headerLine: string): string {
  let best = ",";
  let bestCount = 0;
  for (const d of [",", "\t", ";", "|"]) {
    let count = 0;
    let quoted = false;
    for (const ch of headerLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count++;
    }
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

/** RFC 4180 style: quoted fields, doubled quotes, newlines inside quotes, optional BOM. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const d = delimiter ?? detectDelimiter(src.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === d) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export function csvToRecords(text: string): Record<string, unknown>[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

/** Pulls the product array out of a JSON feed: a bare array, or an object holding one under a common key. */
export function jsonToRecords(text: string): Record<string, unknown>[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  if (Array.isArray(data)) return data.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  if (data && typeof data === "object") {
    for (const k of ["products", "items", "data", "results", "entries", "feed"]) {
      const v = (data as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
      if (v && typeof v === "object") {
        const inner = jsonToRecords(JSON.stringify(v));
        if (inner.length) return inner;
      }
    }
  }
  return [];
}

// ------------------------------------------------------------------ record mapping

export type FieldMap = Partial<Record<"id" | "name" | "price" | "compareAt" | "currency" | "url" | "image" | "brand" | "category" | "description" | "stock" | "weight", string>> & {
  include?: string;
  exclude?: string;
  /** eBay sources: the searches to run, one per line. */
  queries?: string;
};

const ALIASES: Record<keyof Omit<FieldMap, "include" | "exclude" | "queries">, string[]> = {
  id: ["id", "sku", "productid", "product_id", "merchantproductid", "merchant_product_id", "awproductid", "aw_product_id", "mpn", "gtin", "itemid"],
  name: ["name", "title", "productname", "product_name"],
  price: ["searchprice", "search_price", "price", "saleprice", "sale_price", "currentprice", "current_price", "storeprice", "store_price"],
  compareAt: ["rrpprice", "rrp_price", "rrp", "wasprice", "was_price", "baseprice", "base_price", "listprice", "list_price", "comparisonprice", "compare_at_price", "regularprice", "regular_price", "originalprice"],
  currency: ["currency", "pricecurrency", "price_currency", "currencycode"],
  url: ["producturl", "product_url", "link", "url", "awdeeplink", "aw_deep_link", "merchantdeeplink", "merchant_deep_link", "deeplink", "productlink"],
  image: ["merchantimageurl", "merchant_image_url", "largeimage", "large_image", "imageurl", "image_url", "imagelink", "image_link", "image", "images", "picture", "awimageurl", "aw_image_url", "thumbnail"],
  brand: ["brand", "brandname", "brand_name", "manufacturer", "vendor"],
  category: ["category", "categoryname", "category_name", "producttype", "product_type", "merchantcategory", "merchant_category", "googleproductcategory", "google_product_category"],
  description: ["description", "productshortdescription", "product_short_description", "shortdescription", "summary", "body"],
  stock: ["instock", "in_stock", "availability", "stockstatus", "stock_status", "stock", "available", "stockquantity"],
  weight: ["weight", "shippingweight", "shipping_weight", "weightgrams", "weight_grams"],
};

const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9_.]/g, "");

function lookup(rec: Record<string, unknown>, path: string): unknown {
  if (path in rec) return rec[path];
  let cur: unknown = rec;
  for (const part of path.split(".")) {
    if (cur && typeof cur === "object" && !Array.isArray(cur) && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
    else if (Array.isArray(cur) && /^\d+$/.test(part)) cur = cur[Number(part)];
    else return undefined;
  }
  return cur;
}

function pick(rec: Record<string, unknown>, field: keyof typeof ALIASES, map: FieldMap): unknown {
  const explicit = map[field];
  if (explicit) return lookup(rec, explicit);
  const keys = new Map(Object.keys(rec).map((k) => [norm(k), k]));
  for (const alias of ALIASES[field]) {
    const k = keys.get(alias.replace(/_/g, "")) ?? keys.get(alias);
    if (k !== undefined) {
      const v = rec[k];
      if (v !== "" && v !== null && v !== undefined) return v;
    }
  }
  return undefined;
}

const OUT = /^(out.?of.?stock|outofstock|sold.?out|discontinued|unavailable|no|false|n|0|preorder_unavailable)$/i;

export function parseStock(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return true;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  const s = String(v).trim().replace(/^https?:\/\/schema\.org\//i, "");
  if (OUT.test(s)) return false;
  if (/^\d+$/.test(s)) return Number(s) > 0;
  return true;
}

function first(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

function parseWeightGrams(v: unknown): number | null {
  const x = first(v);
  if (x === undefined || x === null || x === "") return null;
  const s = String(x).toLowerCase();
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const grams = /kg/.test(s) ? n * 1000 : /lb/.test(s) ? n * 453.6 : /oz/.test(s) ? n * 28.35 : n;
  return Math.min(100_000, Math.round(grams));
}

/** Turns one feed row into an item, or says why it was skipped. Only pounds sterling is accepted. */
export function mapRecord(rec: Record<string, unknown>, map: FieldMap = {}): ParseResult {
  const name = cleanText(first(pick(rec, "name", map)), 160);
  if (!name) return { skip: "no name" };
  const priceRaw = pick(rec, "price", map);
  const price = parsePrice(first(priceRaw));
  if (!price || price.minor <= 0) return { skip: "no valid price" };
  const currencyRaw = pick(rec, "currency", map);
  const currency = (typeof currencyRaw === "string" && currencyRaw.trim() ? currencyRaw.trim().toUpperCase() : price.currency) ?? "GBP";
  if (currency !== "GBP") return { skip: `price is in ${currency}, not GBP` };
  const url = cleanUrl(first(pick(rec, "url", map)));
  const idRaw = first(pick(rec, "id", map));
  const externalId = (idRaw !== undefined && String(idRaw).trim() ? String(idRaw).trim() : url ? canonicalUrl(url) : "").slice(0, 300);
  if (!externalId) return { skip: "no id or link" };
  const compare = parsePrice(first(pick(rec, "compareAt", map)));
  const compareAt = compare && compare.minor > price.minor && (compare.currency ?? "GBP") === "GBP" ? compare.minor : null;
  const imgRaw = first(pick(rec, "image", map));
  const image = cleanUrl(typeof imgRaw === "object" && imgRaw ? (imgRaw as Record<string, unknown>).url : imgRaw);
  return {
    item: {
      externalId,
      productUrl: url,
      name,
      brand: cleanText(first(pick(rec, "brand", map)), 80),
      category: lastSegment(cleanText(first(pick(rec, "category", map)), 200)),
      description: cleanText(first(pick(rec, "description", map)), 2000),
      priceMinor: price.minor,
      compareAtMinor: compareAt,
      imageUrl: image,
      inStock: parseStock(pick(rec, "stock", map)),
      weightGrams: parseWeightGrams(pick(rec, "weight", map)),
    },
  };
}

// ------------------------------------------------------------------ sitemaps

export function parseSitemap(xml: string): { urls: string[]; sitemaps: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => decodeEntities(m[1]));
  if (/<sitemapindex/i.test(xml)) return { urls: [], sitemaps: locs };
  return { urls: locs, sitemaps: [] };
}

// ------------------------------------------------------------------ product pages

function asArray<T>(v: T | T[] | undefined | null): T[] {
  return v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];
}

function hasType(node: Record<string, unknown>, type: string): boolean {
  return asArray(node["@type"] as string | string[]).some((t) => String(t).toLowerCase() === type.toLowerCase());
}

function walkNodes(value: unknown, out: Record<string, unknown>[], depth = 0): void {
  if (depth > 6 || !value) return;
  if (Array.isArray(value)) { for (const v of value) walkNodes(v, out, depth + 1); return; }
  if (typeof value !== "object") return;
  const node = value as Record<string, unknown>;
  out.push(node);
  for (const k of ["@graph", "mainEntity", "itemListElement", "item", "hasVariant"]) if (k in node) walkNodes(node[k], out, depth + 1);
}

function offerPrices(offers: unknown): { minor: number; currency: string | null; inStock: boolean; list: number | null }[] {
  const out: { minor: number; currency: string | null; inStock: boolean; list: number | null }[] = [];
  for (const o of asArray(offers as unknown)) {
    if (!o || typeof o !== "object") continue;
    const offer = o as Record<string, unknown>;
    const nested = offer.offers;
    if (nested) out.push(...offerPrices(nested));
    const specs = asArray(offer.priceSpecification as Record<string, unknown> | Record<string, unknown>[]);
    const listSpec = specs.find((s) => /list|strike/i.test(String(s.priceType ?? "")));
    const currentSpec = specs.find((s) => !/list|strike/i.test(String(s.priceType ?? "")));
    const raw = offer.price ?? offer.lowPrice ?? currentSpec?.price;
    const price = parsePrice(typeof raw === "string" || typeof raw === "number" ? raw : undefined);
    if (!price) continue;
    const cur = (offer.priceCurrency ?? currentSpec?.priceCurrency ?? price.currency) as string | null | undefined;
    const list = listSpec ? parsePrice(listSpec.price as string | number | undefined)?.minor ?? null : null;
    out.push({ minor: price.minor, currency: cur ? String(cur).toUpperCase() : null, inStock: parseStock(offer.availability), list });
  }
  return out;
}

function metaContent(html: string, prop: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop.replace(/[:.]/g, "\\$&")}["'][^>]*>`, "i");
  const tag = re.exec(html)?.[0];
  if (!tag) return "";
  return decodeEntities(/content=["']([^"']*)["']/i.exec(tag)?.[1] ?? "");
}

/** Reads the structured product data a shop publishes on a product page (JSON-LD, then Open Graph). */
export function extractPageProduct(html: string, pageUrl: string): ParseResult {
  const nodes: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walkNodes(JSON.parse(m[1].trim()), nodes);
    } catch {
      /* ignore malformed blocks */
    }
  }
  const product = nodes.find((n) => hasType(n, "Product") || hasType(n, "ProductGroup"));
  const canonical = canonicalUrl(pageUrl);

  if (product) {
    const variants = nodes.filter((n) => n !== product && hasType(n, "Product"));
    const prices = [...offerPrices(product.offers), ...(hasType(product, "ProductGroup") ? variants.flatMap((v) => offerPrices(v.offers)) : [])];
    const gbp = prices.filter((p) => (p.currency ?? "GBP") === "GBP" && p.minor > 0);
    if (prices.length && gbp.length === 0) return { skip: `price is in ${prices[0].currency}, not GBP` };
    if (gbp.length === 0) return { skip: "no price on the page" };
    const best = gbp.reduce((a, b) => (b.minor < a.minor ? b : a));
    const brandRaw = product.brand;
    const brand = typeof brandRaw === "string" ? brandRaw : brandRaw && typeof brandRaw === "object" ? String((brandRaw as Record<string, unknown>).name ?? "") : "";
    const imageRaw = first(product.image);
    const image = cleanUrl(typeof imageRaw === "object" && imageRaw ? (imageRaw as Record<string, unknown>).url : imageRaw, pageUrl);
    const weight = product.weight as Record<string, unknown> | string | number | undefined;
    let weightGrams: number | null = null;
    if (weight && typeof weight === "object") {
      const v = Number(weight.value);
      const unit = String(weight.unitCode ?? weight.unitText ?? "").toUpperCase();
      if (Number.isFinite(v) && v > 0) weightGrams = Math.round(/KGM|KG/.test(unit) ? v * 1000 : v);
    } else weightGrams = parseWeightGrams(weight);
    const name = tidyTitle(cleanText(product.name, 400));
    if (!name) return { skip: "no product name" };
    return {
      item: {
        externalId: canonical,
        productUrl: cleanUrl(pageUrl),
        name,
        brand: cleanText(brand, 80),
        category: lastSegment(cleanText(first(product.category) as string, 200)),
        description: cleanText(product.description, 2000),
        priceMinor: best.minor,
        compareAtMinor: best.list && best.list > best.minor ? best.list : null,
        imageUrl: image,
        inStock: gbp.some((p) => p.inStock),
        weightGrams,
      },
    };
  }

  const amount = metaContent(html, "product:price:amount") || metaContent(html, "og:price:amount");
  if (amount) {
    const currency = (metaContent(html, "product:price:currency") || metaContent(html, "og:price:currency") || "GBP").toUpperCase();
    const price = parsePrice(amount);
    const name = tidyTitle(cleanText(metaContent(html, "og:title"), 400));
    if (!price || price.minor <= 0 || !name) return { skip: "no usable product data" };
    if (currency !== "GBP") return { skip: `price is in ${currency}, not GBP` };
    return {
      item: {
        externalId: canonical,
        productUrl: cleanUrl(pageUrl),
        name,
        brand: cleanText(metaContent(html, "product:brand"), 80),
        category: "",
        description: cleanText(metaContent(html, "og:description"), 2000),
        priceMinor: price.minor,
        compareAtMinor: null,
        imageUrl: cleanUrl(metaContent(html, "og:image"), pageUrl),
        inStock: parseStock(metaContent(html, "product:availability") || metaContent(html, "og:availability")),
        weightGrams: null,
      },
    };
  }
  return { skip: "no product data on the page" };
}
