import "server-only";
import type Database from "better-sqlite3";
import { db } from "../db";
import { getIntegration, readConfig } from "../integrations";
import type { Json } from "../json";
import { parseQueries } from "./ebay-queries";
import { cleanText, cleanUrl, parsePrice, type ParseResult } from "./parse";

export { parseQueries };

/**
 * eBay's official Browse API. You create a free developer account, paste the App ID and Cert ID in
 * Admin > Integrations, and a Catalogue source of type eBay turns your searches into real UK listings with eBay's own
 * photos, prices and links. Only fixed-price, new items located in the UK and priced in pounds are asked for.
 */
export type EbayConfig = { appId: string; certId: string; environment: "production" | "sandbox" };
export type FetchLike = typeof fetch;

const HOSTS = { production: "https://api.ebay.com", sandbox: "https://api.sandbox.ebay.com" } as const;
const SCOPE = "https://api.ebay.com/oauth/api_scope";

export function ebayConfig(d: Database.Database = db(), env: NodeJS.ProcessEnv = process.env): EbayConfig | null {
  const def = getIntegration("ebay");
  if (!def) return null;
  const cfg = readConfig(def, d, env);
  if (!cfg.enabled || !cfg.values.appId || !cfg.values.certId) return null;
  return { appId: cfg.values.appId, certId: cfg.values.certId, environment: cfg.values.environment === "sandbox" ? "sandbox" : "production" };
}

export async function ebayToken(cfg: EbayConfig, f: FetchLike = fetch): Promise<string> {
  const res = await f(`${HOSTS[cfg.environment]}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${cfg.appId}:${cfg.certId}`).toString("base64")}` },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: SCOPE }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 400 || res.status === 401) throw new Error("eBay did not accept the App ID and Cert ID. Check them, and that the keys match the environment (Production or Sandbox).");
  if (!res.ok) throw new Error(`eBay's sign-in answered HTTP ${res.status}. Try again later.`);
  const j = (await res.json().catch(() => ({}))) as Json;
  if (typeof j.access_token !== "string" || !j.access_token) throw new Error("eBay's sign-in did not return a token.");
  return j.access_token;
}

export function buildSearchUrl(env: EbayConfig["environment"], query: string, limit: number): string {
  const filter = "buyingOptions:{FIXED_PRICE},conditions:{NEW},itemLocationCountry:GB,priceCurrency:GBP";
  const q = new URLSearchParams({ q: query, limit: String(Math.min(200, Math.max(1, Math.round(limit)))), filter });
  return `${HOSTS[env]}/buy/browse/v1/item_summary/search?${q.toString()}`;
}

/** eBay serves a small thumbnail by default; the same picture is available larger by changing the size in its address. */
export function biggerEbayImage(url: string): string {
  return url.replace(/\/s-l\d+\.(jpg|jpeg|png|webp)(?=$|\?)/i, "/s-l500.$1");
}

export function mapEbayItem(raw: Json): ParseResult {
  const title = cleanText(raw.title, 160);
  if (!title) return { skip: "no title" };
  const price = parsePrice(raw.price?.value);
  if (!price || price.minor <= 0) return { skip: "no valid price" };
  const currency = String(raw.price?.currency ?? "").toUpperCase();
  if (currency !== "GBP") return { skip: `price is in ${currency || "an unknown currency"}, not GBP` };
  const url = cleanUrl(raw.itemWebUrl);
  if (!url) return { skip: "no link back to the listing" };
  const idRaw = String(raw.itemId ?? "").replace(/[^A-Za-z0-9|_-]/g, "");
  if (!idRaw) return { skip: "no item id" };
  const was = raw.marketingPrice?.originalPrice;
  const wasPrice = was && String(was.currency ?? "").toUpperCase() === "GBP" ? parsePrice(was.value) : null;
  const imageRaw = raw.image?.imageUrl ?? raw.thumbnailImages?.[0]?.imageUrl;
  const image = cleanUrl(imageRaw);
  const seller = cleanText(raw.seller?.username, 60);
  return {
    item: {
      externalId: `ebay-${idRaw}`,
      productUrl: url,
      name: title,
      brand: "",
      category: cleanText(raw.categories?.[0]?.categoryName, 60),
      description: cleanText([raw.condition ? `Condition: ${raw.condition}.` : "", seller ? `Sold by ${seller} on eBay.` : ""].filter(Boolean).join(" "), 500),
      priceMinor: price.minor,
      compareAtMinor: wasPrice && wasPrice.minor > price.minor ? wasPrice.minor : null,
      imageUrl: image ? biggerEbayImage(image) : "",
      inStock: true,
      weightGrams: null,
    },
  };
}

export async function searchEbay(cfg: EbayConfig, token: string, query: string, limit: number, f: FetchLike = fetch): Promise<Json[]> {
  const res = await f(buildSearchUrl(cfg.environment, query, limit), {
    headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB", Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 429) throw new Error("eBay says too many requests today. It will try again on the next run.");
  if (res.status === 401 || res.status === 403) throw new Error("eBay refused the search. Your keys may not be approved for Production yet.");
  if (!res.ok) throw new Error(`eBay's search answered HTTP ${res.status}.`);
  const j = (await res.json().catch(() => ({}))) as Json;
  return Array.isArray(j.itemSummaries) ? j.itemSummaries : [];
}
