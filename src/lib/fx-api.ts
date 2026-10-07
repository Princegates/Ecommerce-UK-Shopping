import type Database from "better-sqlite3";
import { db } from "./db";
import { audit } from "./audit";
import { setExchangeRate } from "./fx";
import {
  activeMessagingProvider, getIntegration, isConfigured, readConfig, type ProviderId,
} from "./integrations";
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

const DEFAULT_POLICY: FxPolicy = { mode: "suggest", maxChangePct: 5, alertPct: 3 };

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
  const ours = getSettings(d).fx.rate;
  return (ours - m.rate) / m.rate;
}

export type SyncResult =
  | { ok: false; error: string }
  | { ok: true; rate: number; provider: ProviderId; applied: boolean; reason: string };

/** Fetch the market rate with the chosen provider and store it. Does not change what customers are quoted. */
export async function refreshMarketRate(d: Db = db(), env: NodeJS.ProcessEnv = process.env, f: FetchLike = fetch, now = new Date()): Promise<SyncResult> {
  const active = activeMessagingProvider("rates", d, env);
  if (!active) return { ok: false, error: "No exchange rate provider is set up and switched on." };
  const res = await fetchMarketRate(active.def.id, active.cfg.values, f);
  if (!res.ok) return res;
  const prev = getMarketRate(d);
  if (prev && Math.abs(res.rate - prev.rate) / prev.rate > 0.5) {
    return { ok: false, error: "The new rate differs from the last one by more than 50%, so it was ignored. Check the provider." };
  }
  setSetting("fx_market", { rate: res.rate, provider: active.def.id, fetchedAt: now.toISOString(), asOf: res.asOf } satisfies MarketRate, d);
  return { ok: true, rate: res.rate, provider: active.def.id, applied: false, reason: "Market rate updated." };
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
  const current = getSettings(d).fx;
  const move = Math.abs(market.rate - current.rate) / current.rate;
  if (move < 0.0005) return { applied: false, reason: "Already in line with the market." };
  if (!manual) {
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
