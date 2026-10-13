import "server-only";
import { syncRates } from "./fx-api";

/**
 * Keeps the exchange rates live without anyone pressing a button or setting up a scheduler: every 30 minutes it reads the rate sources
 * (AllRatesToday, Open Exchange Rates, the Bank of Ghana) and, in automatic mode, moves the shop's rate within the limit.
 * With nothing set up it does nothing. Several instances? Set FX_AUTORUN=false on all of them and call /api/cron/fx instead.
 */
const TICK_MS = 30 * 60 * 1000;
const FIRST_MS = 90 * 1000;

type G = typeof globalThis & { __fxTimer?: NodeJS.Timeout; __fxBusy?: boolean };

export function startFxScheduler(env: NodeJS.ProcessEnv = process.env): boolean {
  const g = globalThis as G;
  if (g.__fxTimer) return false;
  if (env.FX_AUTORUN === "false" || env.NODE_ENV === "test") return false;
  const tick = async () => {
    if (g.__fxBusy) return;
    g.__fxBusy = true;
    try {
      const r = await syncRates();
      console.log(r.ok ? `[fx] ${r.reason}` : `[fx] ${r.error}`);
    } catch (e) {
      console.error("[fx] scheduler error:", e instanceof Error ? e.message : "unknown");
    } finally {
      g.__fxBusy = false;
    }
  };
  const first = setTimeout(() => { void tick(); }, FIRST_MS);
  first.unref();
  g.__fxTimer = setInterval(() => { void tick(); }, TICK_MS);
  g.__fxTimer.unref();
  return true;
}
