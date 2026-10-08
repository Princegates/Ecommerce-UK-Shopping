import "server-only";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { db } from "../db";
import { getIntegration, readConfig } from "../integrations";
import type { Json } from "../json";
import { parseProductUrls } from "./diffbot-urls";
import { RobotsCache, assertFetchableUrl, type PoliteDeps } from "./net";
import { cleanText, cleanUrl, parsePrice, type NormalizedItem, type ParseResult } from "./parse";

export { parseProductUrls };

/**
 * Diffbot's Product API reads product pages for us and returns clean data (name, price, was-price, stock, brand, photo). You save your
 * Diffbot token in Admin > Integrations and list product page addresses in a Catalogue source of type Diffbot. Diffbot, not this site,
 * downloads the pages, so each address is checked against the shop's robots.txt here first, and nothing is sent for a page the shop
 * disallows. Every product read uses Diffbot credits.
 */
export type DiffbotConfig = { token: string };
export type FetchLike = typeof fetch;

const ENDPOINT = "https://api.diffbot.com/v3/product";
const CALL_DELAY_MS = 1000;

export type DiffbotGathered = { items: NormalizedItem[]; skips: Map<string, number>; complete: boolean; blocked?: string };

export function diffbotConfig(d: Database.Database = db(), env: NodeJS.ProcessEnv = process.env): DiffbotConfig | null {
  const def = getIntegration("diffbot");
  if (!def) return null;
  const cfg = readConfig(def, d, env);
  if (!cfg.enabled || !cfg.values.token) return null;
  return { token: cfg.values.token };
}

/** Problems with the account or the service stop the whole run; a page Diffbot cannot read only skips that page. */
function accountError(code: number): Error | null {
  if (code === 401 || code === 403) return new Error("Diffbot did not accept the token. Check it in Admin > Integrations.");
  if (code === 402) return new Error("Your Diffbot credits have run out. Add credits or wait for them to renew, then run the source again.");
  if (code === 429) return new Error("Diffbot says too many requests. It will try again on the next run.");
  return null;
}

/** Asks Diffbot to read one product page. Never puts the token in an error message. */
export async function diffbotProduct(cfg: DiffbotConfig, pageUrl: string, f: FetchLike = fetch): Promise<{ object: Json } | { skip: string }> {
  const q = new URLSearchParams({ token: cfg.token, url: pageUrl, timeout: "30000" });
  let res: Response;
  try {
    res = await f(`${ENDPOINT}?${q.toString()}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(60_000) });
  } catch {
    throw new Error("Could not reach Diffbot. It will try again on the next run.");
  }
  const j = (await res.json().catch(() => null)) as Json | null;
  const code = typeof j?.errorCode === "number" ? j.errorCode : res.status;
  const stop = accountError(res.status) ?? (j?.error ? accountError(code) : null);
  if (stop) throw stop;
  if (res.status >= 500 && !j?.error) throw new Error(`Diffbot answered HTTP ${res.status}. It will try again on the next run.`);
  if (j?.error || !res.ok) return { skip: "Diffbot could not read the page" };
  const objects: Json[] = Array.isArray(j?.objects) ? j.objects : [];
  const object = objects.find((o) => o && (o.type === "product" || o.offerPrice !== undefined || o.offerPriceDetails !== undefined));
  return object ? { object } : { skip: "no product found on the page" };
}

function pounds(details: Json | undefined, text: unknown): number | null {
  const label = String(details?.text ?? text ?? "");
  const symbol = String(details?.symbol ?? "");
  const named = symbol || label;
  if (named && !/£|GBP/i.test(named)) return null;
  if (typeof details?.amount === "number") {
    const p = parsePrice(details.amount);
    return p && p.minor > 0 ? p.minor : null;
  }
  const p = parsePrice(typeof text === "string" ? text : label);
  return p && p.currency === "GBP" && p.minor > 0 ? p.minor : null;
}

/** One Diffbot product into one product here. Only prices clearly in pounds are accepted. */
export function mapDiffbotProduct(obj: Json, inputUrl: string): ParseResult {
  const name = cleanText(obj.title, 160);
  if (!name) return { skip: "no title" };
  const priceMinor = pounds(obj.offerPriceDetails, obj.offerPrice);
  if (priceMinor === null) return { skip: "no price in pounds" };
  const productUrl = cleanUrl(inputUrl);
  if (!productUrl) return { skip: "no link back to the product" };
  const regular = pounds(obj.regularPriceDetails, obj.regularPrice) ?? 0;
  const images: Json[] = Array.isArray(obj.images) ? obj.images : [];
  const image = cleanUrl((images.find((i) => i?.primary) ?? images[0])?.url);
  return {
    item: {
      externalId: `diffbot-${createHash("sha1").update(productUrl).digest("hex").slice(0, 16)}`,
      productUrl, name, brand: cleanText(obj.brand, 80), category: cleanText(obj.category, 60), description: cleanText(obj.text, 1500),
      priceMinor, compareAtMinor: regular > priceMinor ? regular : null, imageUrl: image, inStock: obj.availability !== false, weightGrams: null,
    },
  };
}

/** Reads each listed page once per run (up to maxItems). A list is never complete: pages you remove are hidden by the stale rule, not here. */
export async function gatherDiffbot(urlsText: string, maxItems: number, cfg: DiffbotConfig, dp: PoliteDeps, f?: FetchLike): Promise<DiffbotGathered> {
  const urls = parseProductUrls(urlsText);
  if (urls.length === 0) throw new Error("This source has no product page addresses. Add one per line.");
  const robots = new RobotsCache(dp);
  const sleep = dp.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const skips = new Map<string, number>();
  const seen = new Set<string>();
  const items: NormalizedItem[] = [];
  const skip = (why: string) => skips.set(why, (skips.get(why) ?? 0) + 1);
  let calls = 0;
  for (const address of urls.slice(0, maxItems)) {
    let page: URL;
    try {
      page = assertFetchableUrl(address);
    } catch {
      skip("not a public web address");
      continue;
    }
    if (!(await robots.allowed(page)).ok) { skip("the shop's robots.txt does not allow it"); continue; }
    if (calls++ > 0) await sleep(CALL_DELAY_MS);
    const r = await diffbotProduct(cfg, address, f);
    if ("skip" in r) { skip(r.skip); continue; }
    const m = mapDiffbotProduct(r.object, address);
    if ("skip" in m) { skip(m.skip); continue; }
    if (seen.has(m.item.externalId)) continue;
    seen.add(m.item.externalId);
    items.push(m.item);
  }
  return { items, skips, complete: false };
}
