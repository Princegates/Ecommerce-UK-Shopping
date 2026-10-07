import type Database from "better-sqlite3";
import { db } from "./db";
import { setSetting } from "./settings";

type Db = Database.Database;

export const STALE_AFTER_DAYS = 3;

export type RateChange = { id: number; rate: number; markupPct: number; note: string; changedAt: string };

export function validateRate(rate: number, markupPct: number): string | null {
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1000) return "Enter the exchange rate as GH₵ per £1, for example 15.20.";
  if (rate < 1) return "That rate looks too low. Enter how many cedis one pound buys.";
  if (!Number.isFinite(markupPct) || markupPct < 0 || markupPct > 50) return "The markup must be between 0 and 50 percent.";
  return null;
}

/** Set the exchange rate customers are quoted at, and keep a history of every change. */
export function setExchangeRate(rate: number, markupPct: number, note: string, d: Db = db()): { ok: true } | { ok: false; error: string } {
  const problem = validateRate(rate, markupPct);
  if (problem) return { ok: false, error: problem };
  d.transaction(() => {
    setSetting("fx_rate", rate, d);
    setSetting("fx_markup_pct", markupPct, d);
    d.prepare("INSERT INTO fx_rate_history (rate, markup_pct, note) VALUES (?, ?, ?)").run(rate, markupPct, note.trim().slice(0, 200));
  })();
  return { ok: true };
}

export function rateHistory(limit = 15, d: Db = db()): RateChange[] {
  const rows = d.prepare("SELECT * FROM fx_rate_history ORDER BY id DESC LIMIT ?").all(limit) as {
    id: number; rate: number; markup_pct: number; note: string; changed_at: string;
  }[];
  return rows.map((r) => ({ id: r.id, rate: r.rate, markupPct: r.markup_pct, note: r.note, changedAt: r.changed_at }));
}

/** Days since the rate was last set by an admin, or null if it never has been. */
export function rateAgeDays(d: Db = db()): number | null {
  const r = d.prepare("SELECT (julianday('now') - julianday(MAX(changed_at))) AS days FROM fx_rate_history").get() as { days: number | null };
  return r.days === null ? null : Math.floor(r.days);
}
