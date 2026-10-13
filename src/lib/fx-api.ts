import type Database from "better-sqlite3";
import { db } from "./db";
import { audit } from "./audit";
import { setExchangeRate } from "./fx";
import {
  getIntegration, getChannelProviderId, isConfigured, providersFor, readConfig, type ProviderId,
} from "./integrations";
import { cleanSources, fxHealth, MID_PRIORITY, type FxHealth, type FxSources, type SourceId } from "./fx-sources";
import { BlockedError, HttpError, RobotsCache, UnsafeUrlError, bodyText, politeFetch, type PoliteDeps } from "./ingest/net";
import { getSetting, getSettings, setSetting } from "./settings";

type Db = Database.Database;
type FetchLike = typeof fetch;

export type MarketRate = { rate: number; provider: ProviderId; fetchedAt: string; asOf: string | null };
export type RateFetch = { ok: true; rate: number; asOf: string | null } | { ok: false; error: string };

const TIMEOUT = 10_000;
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

const iso = (unixSeconds: unknown): string | null =>
  typeof unixSeconds === "number" && Number.isFinite(unixSeconds) ? new Date(unixSeconds * 1000).toISOString() : null;

/**
 * Ask a provider for the GHS-per-GBP market rate. Errors are short and never include the address
 * or the key, since ExchangeRate-API carries its key in the path.
 */
export async function fetchMarketRate(id: ProviderId, values: Record<string, string>, f: FetchLike = fetch): Promise<RateFetch> {
  try {
    if (id === "exchangerate_api") {
      const res = await f(`https://v6.exchangerate-api.com/v6/${encodeURIComponent(values.apiKey ?? "")}/pair/GBP/GHS`, { signal: AbortSignal.timeout(TIMEOUT) });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (j.result === "success" && typeof j.conversion_rate === "number") return sane(j.conversion_rate, iso(j.time_last_update_unix));
      return { ok: false, error: `ExchangeRate-API: ${typeof j["error-type"] === "string" ? j["error-type"] : `HTTP ${res.status}`}` };
    }
    if (id === "allratestoday") {
      const url = new URL("https://allratestoday.com/api/v1/rates");
      url.searchParams.set("source", "GBP");
      url.searchParams.set("target", "GHS");
      const res = await f(url.toString(), { headers: { Authorization: `Bearer ${values.apiKey ?? ""}` }, signal: AbortSignal.timeout(TIMEOUT) });
      const j = (await res.json().catch(() => ({}))) as unknown;
      // The answer is one pair, or a list of pairs; read the GBP-to-GHS one either way.
      const entry = (Array.isArray(j) ? j.find((x) => x && (x as { target?: string }).target === "GHS") ?? j[0] : j) as { rate?: unknown; time?: unknown; error?: unknown } | undefined;
      if (res.ok && entry && typeof entry.rate === "number") {
        const t = typeof entry.time === "string" && Number.isFinite(Date.parse(entry.time)) ? new Date(entry.time).toISOString() : null;
        return sane(entry.rate, t);
      }
      const msg = entry && typeof entry.error === "string" ? entry.error : `HTTP ${res.status}`;
      return { ok: false, error: `AllRatesToday: ${msg}` };
    }
    if (id === "openexchangerates") {
      const res = await f("https://openexchangerates.org/api/latest.json?symbols=GBP,GHS", {
        headers: { Authorization: `Token ${values.appId ?? ""}` },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      const j = (await res.json().catch(() => ({}))) as { rates?: Record<string, number>; timestamp?: number; message?: string };
      const gbp = j.rates?.GBP;
      const ghs = j.rates?.GHS;
      // Free plans quote against USD, so the pound-to-cedi rate is the cross of the two.
      if (res.ok && typeof gbp === "number" && typeof ghs === "number" && gbp > 0) return sane(ghs / gbp, iso(j.timestamp));
      return { ok: false, error: `Open Exchange Rates: ${typeof j.message === "string" ? j.message : `HTTP ${res.status}`}` };
    }
    return { ok: false, error: "Unknown rate provider." };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "The rate provider did not answer in time." : "Could not reach the rate provider." };
  }
}

/** Reject anything that cannot be a real pound-to-cedi rate, such as a glitch returning zero or a huge number. */
function sane(rate: number, asOf: string | null): RateFetch {
  if (!Number.isFinite(rate) || rate < 1 || rate > 1000) return { ok: false, error: "The provider returned a rate that does not look right." };
  return { ok: true, rate: round4(rate), asOf };
}

// ------------------------------------------------------------------- settings

export type FxMode = "manual" | "suggest" | "auto";
export type FxPolicy = { mode: FxMode; maxChangePct: number; alertPct: number };

const DEFAULT_POLICY: FxPolicy = { mode: "auto", maxChangePct: 5, alertPct: 3 };

export function getFxPolicy(d: Db = db()): FxPolicy {
  const raw = getSetting<Partial<FxPolicy>>("fx_policy", d) ?? {};
  const num = (v: unknown, fallback: number, min: number, max: number) => (typeof v === "number" && v >= min && v <= max ? v : fallback);
  return {
    mode: raw.mode === "manual" || raw.mode === "auto" || raw.mode === "suggest" ? raw.mode : DEFAULT_POLICY.mode,
    maxChangePct: num(raw.maxChangePct, DEFAULT_POLICY.maxChangePct, 0.1, 50),
    alertPct: num(raw.alertPct, DEFAULT_POLICY.alertPct, 0.1, 50),
  };
}

export function saveFxPolicy(p: FxPolicy, d: Db = db()): { ok: true } | { ok: false; error: string } {
  if (!["manual", "suggest", "auto"].includes(p.mode)) return { ok: false, error: "Choose how the rate is kept up to date." };
  if (!(p.maxChangePct >= 0.1 && p.maxChangePct <= 50)) return { ok: false, error: "The largest automatic change must be between 0.1 and 50 percent." };
  if (!(p.alertPct >= 0.1 && p.alertPct <= 50)) return { ok: false, error: "The alert level must be between 0.1 and 50 percent." };
  setSetting("fx_policy", p, d);
  return { ok: true };
}

export function getMarketRate(d: Db = db()): MarketRate | null {
  const v = getSetting<MarketRate>("fx_market", d);
  return v && typeof v.rate === "number" && typeof v.fetchedAt === "string" ? v : null;
}

/** How far our quoted base rate is from the market, as a fraction (positive: we are above the market). */
export function drift(d: Db = db()): number | null {
  const m = getMarketRate(d);
  if (!m) return null;
  const ours = getSettings(d).market.mid;
  return (ours - m.rate) / m.rate;
}

export type SyncResult =
  | { ok: false; error: string }
  | { ok: true; rate: number; provider: ProviderId; applied: boolean; reason: string };

// ------------------------------------------------------------ Bank of Ghana

export const BOG_URL = "https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const cellText = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** The date printed on the page, as YYYY-MM-DD, or null. */
function pageDate(text: string): string | null {
  const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) return iso[0];
  const long = /\b(\d{1,2})(?:st|nd|rd|th)?[ ,/-]+([A-Za-z]{3,9})[ ,/-]+(20\d{2})\b/.exec(text);
  if (long) {
    const m = MONTHS.indexOf(long[2].slice(0, 3).toLowerCase());
    if (m >= 0) return `${long[3]}-${String(m + 1).padStart(2, "0")}-${long[1].padStart(2, "0")}`;
  }
  const slash = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/.exec(text);
  if (slash) return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  return null;
}

/**
 * Reads the British pound's mid rate from the Bank of Ghana's daily interbank page. The page lists buying, selling and mid rates per
 * currency; the row for the pound is found by its code or name and the mid rate is taken (or the average of buying and selling).
 */
export function parseBogRate(html: string): RateFetch {
  const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => cellText(m[0]));
  const row = rows.find((r) => /\bGBP\b|pound sterling|british pound|\bUK pound\b|\bpound\b/i.test(r) && /\d+\.\d{2,}/.test(r));
  if (!row) return { ok: false, error: "Bank of Ghana: the pound row was not found on the page." };
  // keep the figures after the currency name, so a date or code in the row is not read as a rate
  const figures = [...row.matchAll(/\b\d{1,3}(?:,\d{3})*\.\d{2,6}\b|\b\d{1,3}\.\d{2,6}\b/g)].map((m) => Number(m[0].replace(/,/g, ""))).filter((n) => Number.isFinite(n));
  if (figures.length === 0) return { ok: false, error: "Bank of Ghana: no rate was found in the pound row." };
  let rate: number;
  if (figures.length >= 3) {
    const [buy, sell, mid] = figures.slice(-3);
    rate = mid >= Math.min(buy, sell) && mid <= Math.max(buy, sell) ? mid : (buy + sell) / 2;
  } else if (figures.length === 2) rate = (figures[0] + figures[1]) / 2;
  else rate = figures[0];
  const date = pageDate(cellText(html.slice(0, 200_000)));
  const checked = sane(rate, date);
  return checked.ok ? checked : { ok: false, error: "Bank of Ghana: the page showed a rate that does not look right." };
}

/** Reads the Bank of Ghana's official pound rate, obeying the site's robots.txt and pacing like any other reader. */
export async function fetchBogRate(deps: PoliteDeps = {}): Promise<RateFetch> {
  try {
    const url = new URL(BOG_URL);
    const allowed = await new RobotsCache(deps).allowed(url);
    if (!allowed.ok) return { ok: false, error: "Bank of Ghana: the website's robots.txt does not allow automated reading of the rates page." };
    const { res } = await politeFetch(BOG_URL, deps, { maxBytes: 3_000_000, timeoutMs: 20_000 });
    return parseBogRate(bodyText(res));
  } catch (e) {
    if (e instanceof BlockedError) return { ok: false, error: "Bank of Ghana: the website refused automated access." };
    if (e instanceof HttpError) return { ok: false, error: `Bank of Ghana: the website answered HTTP ${e.status}.` };
    if (e instanceof UnsafeUrlError) return { ok: false, error: "Bank of Ghana: the address is not allowed." };
    return { ok: false, error: "Could not reach the Bank of Ghana website." };
  }
}

// ----------------------------------------------------------------- sources

export function getFxSources(d: Db = db()): FxSources {
  return cleanSources(getSetting("fx_sources", d));
}

export type SourceErrors = Partial<Record<SourceId, string>>;
export function getSourceErrors(d: Db = db()): SourceErrors {
  const v = getSetting<SourceErrors>("fx_source_errors", d);
  return v && typeof v === "object" ? v : {};
}

/** The widest gap between fresh sources against the limit in the pricing configuration, and whether new quotes are on hold. */
export function getFxHealth(d: Db = db(), now: Date = new Date()): FxHealth {
  return fxHealth(getFxSources(d), getSettings(d).pricing.fx.divergenceFreezePct, now);
}

/** Mid-market feeds that are switched on and ready, the chosen one first, then in order of trust. */
function midFeeds(d: Db, env: NodeJS.ProcessEnv) {
  const chosen = getChannelProviderId("rates", d);
  const ids = [...(chosen ? [chosen] : []), ...MID_PRIORITY].filter((id, i, a) => a.indexOf(id) === i);
  return ids.flatMap((id) => {
    const def = providersFor("rates").find((p) => p.id === id);
    if (!def) return [];
    const cfg = readConfig(def, d, env);
    return cfg.enabled && isConfigured(def, cfg, "rates") ? [{ def, cfg }] : [];
  });
}

export type RefreshDeps = {
  /** Replaces the network for the Bank of Ghana page. In tests, without it the page is not read. */
  bog?: PoliteDeps;
};

/**
 * Reads every source that is set up: each mid-market feed that is switched on, and the Bank of Ghana's official rate. Each reading is
 * stored on its own, the market rate is the first fresh mid-market one (so a second feed covers for the first), and a failed source
 * keeps its error for the admin without disturbing the others. Does not change what customers are quoted.
 */
export async function refreshMarketRate(d: Db = db(), env: NodeJS.ProcessEnv = process.env, f: FetchLike = fetch, now = new Date(), deps: RefreshDeps = {}): Promise<SyncResult> {
  const feeds = midFeeds(d, env);
  const readBog = env.NODE_ENV !== "test" || Boolean(deps.bog);
  if (feeds.length === 0 && !readBog) return { ok: false, error: "No exchange rate provider is set up and switched on." };

  const sources = getFxSources(d);
  const errors: SourceErrors = {};
  const prevMarket = getMarketRate(d);
  let primary: { id: ProviderId; rate: number; asOf: string | null } | null = null;

  for (const { def, cfg } of feeds) {
    const res = await fetchMarketRate(def.id, cfg.values, f);
    if (!res.ok) { errors[def.id as SourceId] = res.error; continue; }
    const before = sources[def.id as SourceId] ?? (prevMarket && prevMarket.provider === def.id ? prevMarket : undefined);
    if (before && Math.abs(res.rate - before.rate) / before.rate > 0.5) {
      errors[def.id as SourceId] = "The new rate differs from the last one by more than 50%, so it was ignored. Check the provider.";
      continue;
    }
    sources[def.id as SourceId] = { rate: res.rate, fetchedAt: now.toISOString(), asOf: res.asOf };
    primary ??= { id: def.id, rate: res.rate, asOf: res.asOf };
  }

  if (readBog) {
    const res = await fetchBogRate(deps.bog ?? {});
    if (res.ok) sources.bank_of_ghana = { rate: res.rate, fetchedAt: now.toISOString(), asOf: res.asOf };
    else errors.bank_of_ghana = res.error;
  }

  setSetting("fx_sources", sources, d);
  setSetting("fx_source_errors", errors, d);
  if (!primary) {
    const first = Object.values(errors)[0];
    return { ok: false, error: first ?? "No exchange rate provider is set up and switched on." };
  }
  setSetting("fx_market", { rate: primary.rate, provider: primary.id, fetchedAt: now.toISOString(), asOf: primary.asOf } satisfies MarketRate, d);
  const health = fxHealth(sources, getSettings(d).pricing.fx.divergenceFreezePct, now);
  return {
    ok: true, rate: primary.rate, provider: primary.id, applied: false,
    reason: health.frozen ? `Market rate updated, but the sources disagree by ${((health.spread ?? 0) * 100).toFixed(1)}%, so new quotes are on hold.` : "Market rate updated.",
  };
}

/**
 * In automatic mode, move the quoted base rate to the market rate when the move is small enough.
 * A bigger move is held for an admin to approve, because a bad feed should not reprice the shop.
 * The admin's markup is never touched.
 */
export function applyMarketRate(d: Db = db(), manual = false): { applied: boolean; reason: string } {
  const policy = getFxPolicy(d);
  const market = getMarketRate(d);
  if (!market) return { applied: false, reason: "No market rate yet." };
  const current = { rate: getSettings(d).market.mid, markupPct: 0 };
  const move = Math.abs(market.rate - current.rate) / current.rate;
  if (move < 0.0005) return { applied: false, reason: "Already in line with the market." };
  if (!manual) {
    const health = getFxHealth(d);
    if (health.frozen) return { applied: false, reason: `The rate sources disagree by ${((health.spread ?? 0) * 100).toFixed(1)}%, so the rate was not changed. Review it.` };
    if (policy.mode !== "auto") return { applied: false, reason: "Automatic updates are off." };
    if (move * 100 > policy.maxChangePct) {
      return { applied: false, reason: `The market moved ${(move * 100).toFixed(1)}%, more than your ${policy.maxChangePct}% limit. Review it.` };
    }
  }
  const res = setExchangeRate(market.rate, current.markupPct, manual ? `Applied market rate from ${market.provider}` : `Automatic update from ${market.provider}`, d);
  if (!res.ok) return { applied: false, reason: res.error };
  audit(manual ? "rate.apply-market" : "rate.auto-update", "exchange rate", `GH₵${current.rate} to GH₵${market.rate} (${market.provider})`, d, manual ? "admin" : "system");
  return { applied: true, reason: `Rate set to GH₵${market.rate}.` };
}

/** What the scheduled job runs: refresh the market rate, then apply it if the policy allows. */
export async function syncRates(d: Db = db(), env: NodeJS.ProcessEnv = process.env, f: FetchLike = fetch): Promise<SyncResult> {
  const r = await refreshMarketRate(d, env, f);
  if (!r.ok) return r;
  const a = applyMarketRate(d, false);
  return { ...r, applied: a.applied, reason: a.reason };
}

/** A one-off check that the saved key works, without storing anything. */
export async function testRateProvider(id: ProviderId, d: Db = db(), env: NodeJS.ProcessEnv = process.env, f: FetchLike = fetch): Promise<{ ok: boolean; message: string }> {
  const def = getIntegration(id);
  if (!def || !def.channels.includes("rates")) return { ok: false, message: "That is not an exchange rate provider." };
  const cfg = readConfig(def, d, env);
  if (!isConfigured(def, cfg, "rates")) return { ok: false, message: "Save the key first." };
  const r = await fetchMarketRate(id, cfg.values, f);
  return r.ok ? { ok: true, message: `Market rate right now: £1 = GH₵${r.rate}${r.asOf ? ` (as of ${r.asOf.slice(0, 16).replace("T", " ")} UTC)` : ""}.` } : { ok: false, message: r.error };
}
