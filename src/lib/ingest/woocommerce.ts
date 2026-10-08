import { BlockedError, HttpError, RobotsCache, bodyText, politeFetch, type PoliteDeps } from "./net";
import { cleanText, cleanUrl, type NormalizedItem } from "./parse";
import { shopifyOrigin as shopOrigin } from "./shopify";

/**
 * WooCommerce shops publish their product list through the public Store API at /wp-json/wc/store/v1/products. It is read only when
 * the shop's own robots.txt allows it, only for shops priced in pounds, and it stops at the first refusal.
 */

const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const PAGE_DELAY_MS = 2000;

export type WooGathered = { items: NormalizedItem[]; skips: Map<string, number>; complete: boolean; blocked?: string };

type Named = { name?: unknown };
type RawProduct = {
  id?: unknown; name?: unknown; type?: unknown; permalink?: unknown; description?: unknown; short_description?: unknown; is_in_stock?: unknown;
  prices?: { price?: unknown; regular_price?: unknown; currency_code?: unknown; currency_minor_unit?: unknown; price_range?: { min_amount?: unknown; max_amount?: unknown } | null };
  images?: { src?: unknown }[]; categories?: Named[]; brands?: Named[];
  attributes?: { name?: unknown; has_variations?: unknown; terms?: Named[] }[];
};

/** The Store API gives prices as whole minor units in a string ("4500" is £45.00). Anything else is not trusted. */
function minor(v: unknown): number | null {
  if (typeof v !== "string" || !/^\d{1,9}$/.test(v)) return null;
  return Number(v);
}

const sameSite = (a: string, b: string) => a.replace(/^www\./, "") === b.replace(/^www\./, "");

/** One WooCommerce product into one product here. Variable products whose choices cost different amounts are skipped: we hold a single price. */
export function mapWooProduct(p: RawProduct, origin: string): { item: NormalizedItem } | { skip: string } {
  const id = typeof p.id === "number" || typeof p.id === "string" ? String(p.id) : "";
  if (!id) return { skip: "no product id" };
  const name = cleanText(p.name, 200);
  if (!name) return { skip: "no title" };
  if (p.type === "external") return { skip: "sold on another website" };
  if (p.type === "grouped") return { skip: "grouped product" };
  const productUrl = cleanUrl(p.permalink);
  if (!productUrl) return { skip: "no link back to the product" };
  if (!sameSite(new URL(productUrl).host, new URL(origin).host)) return { skip: "product link points to another website" };
  const pr = p.prices;
  if (!pr) return { skip: "no valid price" };
  if (typeof pr.currency_code !== "string" || pr.currency_code.toUpperCase() !== "GBP" || pr.currency_minor_unit !== 2) return { skip: "not priced in pounds" };
  const priceMinor = minor(pr.price);
  if (priceMinor === null) return { skip: "no valid price" };
  const range = pr.price_range;
  if (range && range.min_amount !== range.max_amount) return { skip: "variants have different prices" };
  const regular = minor(pr.regular_price) ?? 0;
  const images = Array.isArray(p.images) ? p.images : [];
  const categories = Array.isArray(p.categories) ? p.categories : [];
  const brands = Array.isArray(p.brands) ? p.brands : [];
  const options = (Array.isArray(p.attributes) ? p.attributes : [])
    .filter((a) => a.has_variations === true)
    .map((a) => ({
      name: cleanText(a.name, 40),
      values: [...new Set((Array.isArray(a.terms) ? a.terms : []).map((t) => cleanText(t.name, 40)).filter(Boolean))].slice(0, 40),
    }))
    .filter((o) => o.name && o.values.length > 0);
  return {
    item: {
      externalId: `woocommerce-${id}`, productUrl, name, brand: cleanText(brands[0]?.name, 80), category: cleanText(categories[0]?.name, 80),
      description: cleanText(p.description || p.short_description, 1500), priceMinor, compareAtMinor: regular > priceMinor ? regular : null,
      imageUrl: cleanUrl(images[0]?.src), inStock: p.is_in_stock === true, weightGrams: null, options,
    },
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function gatherWooCommerce(address: string, maxItems: number, dp: PoliteDeps): Promise<WooGathered> {
  const origin = shopOrigin(address);
  const robots = new RobotsCache(dp);
  const listUrl = (page: number) => `${origin}/wp-json/wc/store/v1/products?per_page=${PAGE_SIZE}&page=${page}`;
  const rule = await robots.allowed(new URL(listUrl(1)));
  if (!rule.ok) throw new BlockedError("The shop's robots.txt does not allow reading its product list.");
  const delayMs = Math.max(PAGE_DELAY_MS, (rule.delaySeconds ?? 0) * 1000);

  const skips = new Map<string, number>();
  const seen = new Set<string>();
  const items: NormalizedItem[] = [];
  let reachedEnd = false;
  for (let page = 1; page <= MAX_PAGES && items.length < maxItems; page++) {
    let list: unknown;
    let totalPages = 0;
    try {
      const { res } = await politeFetch(listUrl(page), dp, { maxBytes: 12_000_000, timeoutMs: 60_000, delayMs, accept: "application/json,*/*;q=0.5" });
      list = parseJson(bodyText(res, 40_000_000));
      totalPages = Number(res.headers["x-wp-totalpages"]) || 0;
    } catch (e) {
      if (e instanceof HttpError && (e.status === 404 || e.status === 401) && page === 1) {
        throw new Error("That address does not look like a WooCommerce shop, or its product list is switched off.");
      }
      throw e;
    }
    if (!Array.isArray(list)) throw new Error("The shop did not return a product list we could read.");
    if (page === 1 && list.length > 0) {
      const first = (list[0] as RawProduct)?.prices;
      const cur = typeof first?.currency_code === "string" ? first.currency_code.toUpperCase() : "";
      if (cur !== "GBP") throw new Error(cur ? `This shop prices in ${cur}, not pounds, so it cannot be used.` : "Could not tell which currency this shop uses, so it cannot be used.");
    }
    for (const raw of list as RawProduct[]) {
      const m = mapWooProduct(raw ?? {}, origin);
      if ("skip" in m) { skips.set(m.skip, (skips.get(m.skip) ?? 0) + 1); continue; }
      if (seen.has(m.item.externalId)) continue;
      seen.add(m.item.externalId);
      if (items.length < maxItems) items.push(m.item);
    }
    if (list.length < PAGE_SIZE || (totalPages > 0 && page >= totalPages)) { reachedEnd = true; break; }
  }
  // only a list read to its very end may be used to hide products that have disappeared
  return { items, skips, complete: reachedEnd && items.length < maxItems };
}
