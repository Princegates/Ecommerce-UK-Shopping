/**
 * The exchange-rate sources and what can be said about them. Pure: nothing here reads the database or the network, so it is safe to use
 * from the settings code and easy to test.
 *
 * Three kinds of source feed the shop:
 *  - mid-market feeds (AllRatesToday first, Open Exchange Rates or ExchangeRate-API as backups): the rate customers' price is built on,
 *  - the Bank of Ghana's official interbank rate: the rate customs and the GRA use, so the rate import duties are valued at.
 * If fresh sources disagree by more than the pricing configuration allows, new quotes freeze until they agree again.
 */

export type SourceId = "allratestoday" | "openexchangerates" | "exchangerate_api" | "bank_of_ghana";

export type SourceReading = { rate: number; fetchedAt: string; asOf: string | null };
export type FxSources = Partial<Record<SourceId, SourceReading>>;

export const SOURCE_LABEL: Record<SourceId, string> = {
  allratestoday: "AllRatesToday (mid-market)",
  openexchangerates: "Open Exchange Rates (mid-market)",
  exchangerate_api: "ExchangeRate-API (mid-market)",
  bank_of_ghana: "Bank of Ghana (official)",
};

/** Order of trust for the mid-market rate. */
export const MID_PRIORITY: SourceId[] = ["allratestoday", "openexchangerates", "exchangerate_api"];

/** How long a reading stays fresh. The Bank of Ghana publishes on working days only, so its reading lasts through a long weekend. */
export const FRESH_HOURS: Record<SourceId, number> = { allratestoday: 36, openexchangerates: 36, exchangerate_api: 36, bank_of_ghana: 120 };

export const ageHours = (r: SourceReading, now: Date): number => Math.max(0, (now.getTime() - Date.parse(r.fetchedAt)) / 3_600_000);

export function isFresh(id: SourceId, r: SourceReading | undefined, now: Date): r is SourceReading {
  return Boolean(r) && Number.isFinite(Date.parse(r!.fetchedAt)) && ageHours(r!, now) <= FRESH_HOURS[id] && r!.rate > 0;
}

/** Keeps only well-formed readings from whatever was stored. */
export function cleanSources(raw: unknown): FxSources {
  const out: FxSources = {};
  if (!raw || typeof raw !== "object") return out;
  for (const id of Object.keys(SOURCE_LABEL) as SourceId[]) {
    const v = (raw as Record<string, unknown>)[id] as Partial<SourceReading> | undefined;
    if (v && typeof v.rate === "number" && v.rate > 0 && typeof v.fetchedAt === "string") {
      out[id] = { rate: v.rate, fetchedAt: v.fetchedAt, asOf: typeof v.asOf === "string" ? v.asOf : null };
    }
  }
  return out;
}

/** The mid-market reading to price on: the first fresh one in order of trust. */
export function bestMid(src: FxSources, now: Date): { id: SourceId; reading: SourceReading } | null {
  for (const id of MID_PRIORITY) {
    const r = src[id];
    if (isFresh(id, r, now)) return { id, reading: r };
  }
  return null;
}

/** The Bank of Ghana rate to value duties at, while it is fresh. */
export function freshBog(src: FxSources, now: Date): SourceReading | null {
  const r = src.bank_of_ghana;
  return isFresh("bank_of_ghana", r, now) ? r : null;
}

export type FxHealth = {
  /** New quotes are held back because fresh sources disagree by more than the limit. */
  frozen: boolean;
  /** The widest gap between any two fresh sources, as a fraction of the lower one (0.015 is 1.5%); null with fewer than two. */
  spread: number | null;
  limit: number;
  /** The two sources furthest apart. */
  widest: { low: SourceId; high: SourceId } | null;
  sources: { id: SourceId; label: string; rate: number; fetchedAt: string; ageHours: number; fresh: boolean }[];
};

export function fxHealth(src: FxSources, limit: number, now: Date = new Date()): FxHealth {
  const all = (Object.keys(SOURCE_LABEL) as SourceId[]).flatMap((id) => {
    const r = src[id];
    return r ? [{ id, label: SOURCE_LABEL[id], rate: r.rate, fetchedAt: r.fetchedAt, ageHours: Math.round(ageHours(r, now) * 10) / 10, fresh: isFresh(id, r, now) }] : [];
  });
  const fresh = all.filter((s) => s.fresh);
  if (fresh.length < 2) return { frozen: false, spread: null, limit, widest: null, sources: all };
  const low = fresh.reduce((a, b) => (b.rate < a.rate ? b : a));
  const high = fresh.reduce((a, b) => (b.rate > a.rate ? b : a));
  const spread = (high.rate - low.rate) / low.rate;
  return { frozen: spread > limit, spread, limit, widest: { low: low.id, high: high.id }, sources: all };
}
