import { BlockedError, HttpError, RobotsCache, assertFetchableUrl, bodyText, politeFetch, type PoliteDeps } from "./net";
import { cleanText, cleanUrl, type NormalizedItem } from "./parse";

/**
 * Shopify shops publish their product list as plain JSON at /products.json. It is read only when the shop's own
 * robots.txt allows it, only for shops priced in pounds, and it stops at the first refusal.
 */

const PAGE_SIZE = 250;
const MAX_PAGES = 20;
const PAGE_DELAY_MS = 2000;

export type ShopifyGathered = { items: NormalizedItem[]; skips: Map<string, number>; complete: boolean; blocked?: string };

type Variant = { id?: unknown; title?: unknown; price?: unknown; compare_at_price?: unknown; available?: unknown; grams?: unknown };
type RawProduct = {
  id?: unknown; title?: unknown; handle?: unknown; body_html?: unknown; vendor?: unknown; product_type?: unknown;
  variants?: Variant[]; images?: { src?: unknown }[]; options?: { name?: unknown; values?: unknown }[];
};

/** "https://shop.example/anything" or "shop.example" becomes "https://shop.example"; anything unsafe throws. */
export function shopifyOrigin(input: string): string {
  const text = input.trim();
  const url = assertFetchableUrl(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  return `${url.protocol}//${url.host}`;
}

function pence(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
  return Math.round(n * 100);
}

/** One Shopify product into one product here. Shops whose variants cost different amounts are skipped: we hold a single price. */
export function mapShopifyProduct(p: RawProduct, origin: string): { item: NormalizedItem } | { skip: string } {
  const id = typeof p.id === "number" || typeof p.id === "string" ? String(p.id) : "";
  if (!id) return { skip: "no product id" };
  const name = cleanText(p.title, 200);
  if (!name) return { skip: "no title" };
  const handle = typeof p.handle === "string" ? p.handle.trim() : "";
  const productUrl = handle ? cleanUrl(`${origin}/products/${encodeURIComponent(handle)}`) : "";
  if (!productUrl) return { skip: "no link back to the product" };
  const variants = Array.isArray(p.variants) ? p.variants : [];
  if (variants.length === 0) return { skip: "no variants" };
  const prices = variants.map((v) => pence(v.price));
  if (prices.some((x) => x === null)) return { skip: "no valid price" };
  const distinct = new Set(prices as number[]);
  if (distinct.size > 1) return { skip: "variants have different prices" };
  const priceMinor = [...distinct][0];
  const compare = Math.max(0, ...variants.map((v) => pence(v.compare_at_price) ?? 0));
  const grams = variants.map((v) => (typeof v.grams === "number" ? v.grams : 0)).find((g) => g > 0);
  const images = Array.isArray(p.images) ? p.images : [];
  const options = (Array.isArray(p.options) ? p.options : [])
    .map((o) => ({
      name: cleanText(o.name, 40),
      values: [...new Set((Array.isArray(o.values) ? o.values : []).map((x) => cleanText(x, 40)).filter(Boolean))].slice(0, 40),
    }))
    .filter((o) => o.name && o.values.length > 0 && !(o.values.length === 1 && o.values[0].toLowerCase() === "default title"));
  return {
    item: {
      externalId: `shopify-${id}`, productUrl, name, brand: cleanText(p.vendor, 80), category: cleanText(p.product_type, 80),
      description: cleanText(p.body_html, 1500), priceMinor, compareAtMinor: compare > priceMinor ? compare : null,
      imageUrl: cleanUrl(images[0]?.src), inStock: variants.some((v) => v.available === true), weightGrams: grams ?? null, options,
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

/** Reads the shop's currency from its public /meta.json; the list is used only when it is pounds. */
async function shopCurrency(origin: string, dp: PoliteDeps): Promise<string | null> {
  const { res } = await politeFetch(`${origin}/meta.json`, dp, { maxBytes: 200_000, timeoutMs: 20_000, delayMs: PAGE_DELAY_MS, accept: "application/json,*/*;q=0.5" });
  const meta = parseJson(bodyText(res, 400_000)) as { currency?: unknown } | null;
  return typeof meta?.currency === "string" ? meta.currency.toUpperCase() : null;
}

export async function gatherShopify(address: string, maxItems: number, dp: PoliteDeps): Promise<ShopifyGathered> {
  const origin = shopifyOrigin(address);
  const robots = new RobotsCache(dp);
  const listUrl = (page: number) => `${origin}/products.json?limit=${PAGE_SIZE}&page=${page}`;
  const rule = await robots.allowed(new URL(listUrl(1)));
  if (!rule.ok) throw new BlockedError("The shop's robots.txt does not allow reading its product list.");
  const delayMs = Math.max(PAGE_DELAY_MS, (rule.delaySeconds ?? 0) * 1000);

  let currency: string | null;
  try {
    currency = await shopCurrency(origin, dp);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) throw new Error("That address does not look like a Shopify shop.");
    throw e;
  }
  if (currency !== "GBP") throw new Error(currency ? `This shop prices in ${currency}, not pounds, so it cannot be used.` : "Could not tell which currency this shop uses, so it cannot be used.");

  const skips = new Map<string, number>();
  const seen = new Set<string>();
  const items: NormalizedItem[] = [];
  let reachedEnd = false;
  for (let page = 1; page <= MAX_PAGES && items.length < maxItems; page++) {
    let body: { products?: RawProduct[] } | null;
    try {
      const { res } = await politeFetch(listUrl(page), dp, { maxBytes: 12_000_000, timeoutMs: 60_000, delayMs, accept: "application/json,*/*;q=0.5" });
      body = parseJson(bodyText(res, 40_000_000)) as { products?: RawProduct[] } | null;
    } catch (e) {
      if (e instanceof HttpError && e.status === 404 && page === 1) throw new Error("That address does not look like a Shopify shop, or its product list is switched off.");
      throw e;
    }
    if (!body || !Array.isArray(body.products)) throw new Error("The shop did not return a product list we could read.");
    for (const raw of body.products) {
      const m = mapShopifyProduct(raw, origin);
      if ("skip" in m) { skips.set(m.skip, (skips.get(m.skip) ?? 0) + 1); continue; }
      if (seen.has(m.item.externalId)) continue;
      seen.add(m.item.externalId);
      if (items.length < maxItems) items.push(m.item);
    }
    if (body.products.length < PAGE_SIZE) { reachedEnd = true; break; }
  }
  // only a list read to its very end may be used to hide products that have disappeared
  return { items, skips, complete: reachedEnd && items.length < maxItems };
}
