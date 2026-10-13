import type Database from "better-sqlite3";
import { db } from "./db";
import { fxHealth } from "./fx-sources";
import type { FxConfig } from "./pricing";
import { customerRate } from "./quote-engine";
import { getSettings, type MarketContext } from "./settings";

type Db = Database.Database;

/**
 * The exchange rate a shopper's quote is priced at. The first time someone looks at a cart or a quoted item, the market rate is held for
 * them for the time the pricing configuration sets (30 minutes), so the total they were shown stays the total they pay while they check
 * out. Afterwards a fresh rate is held for a fresh quote.
 *
 * If the rate sources disagree by more than the configuration allows, no new quote is given until they agree again. A quote already held
 * is still honoured: it is a promise.
 */
export type QuoteMarket = {
  market: MarketContext;
  /** The customer rate to show pounds next to cedis with. */
  fx: FxConfig;
  /** When the price stops being held (ISO time), or null when nothing is held. */
  lockedUntil: string | null;
  /** New quotes are on hold because the rate sources disagree. */
  frozen: boolean;
  /** The widest gap between sources, as a fraction, when frozen. */
  spread: number | null;
};

export function quoteMarket(key: string | null, d: Db = db(), now: Date = new Date(), opts: { create?: boolean } = {}): QuoteMarket {
  const s = getSettings(d);
  const nowIso = now.toISOString();
  const live: QuoteMarket = { market: s.market, fx: s.fx, lockedUntil: null, frozen: false, spread: null };

  if (key) {
    const row = d.prepare("SELECT mid, customs, move3d, expires_at FROM rate_locks WHERE lock_key = ? AND expires_at > ?").get(key, nowIso) as
      | { mid: number; customs: number; move3d: number; expires_at: string }
      | undefined;
    if (row) {
      return {
        market: { mid: row.mid, customs: row.customs, move3d: row.move3d },
        fx: { rate: customerRate(row.mid, row.move3d, s.pricing).rate, markupPct: 0 },
        lockedUntil: row.expires_at,
        frozen: false,
        spread: null,
      };
    }
  }

  const health = fxHealth(s.fxSources, s.pricing.fx.divergenceFreezePct, now);
  if (health.frozen) return { ...live, frozen: true, spread: health.spread };

  if (key && opts.create !== false) {
    const expires = new Date(now.getTime() + s.pricing.fx.quoteTtlMinutes * 60_000).toISOString();
    d.transaction(() => {
      d.prepare("DELETE FROM rate_locks WHERE expires_at < ?").run(new Date(now.getTime() - 86_400_000).toISOString());
      d.prepare("INSERT OR REPLACE INTO rate_locks (lock_key, mid, customs, move3d, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)").run(
        key, s.market.mid, s.market.customs, s.market.move3d, nowIso, expires,
      );
    })();
    return { ...live, lockedUntil: expires };
  }
  return live;
}
