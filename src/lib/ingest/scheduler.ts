import "server-only";
import { runDueSources } from "./run";

/**
 * Keeps the catalogue fresh without anyone pressing a button. Every few minutes it runs whichever sources are
 * switched on and due (each has its own interval), then hides items that have not been refreshed for too long.
 *
 * It lives inside the server process. If you run several instances, set INGEST_AUTORUN=false on all but one,
 * or on all of them and call /api/cron/ingest from a scheduler instead.
 */
const TICK_MS = 10 * 60 * 1000;
const FIRST_MS = 60 * 1000;

type G = typeof globalThis & { __ingestTimer?: NodeJS.Timeout; __ingestBusy?: boolean };

export function startIngestScheduler(env: NodeJS.ProcessEnv = process.env): boolean {
  const g = globalThis as G;
  if (g.__ingestTimer) return false;
  if (env.INGEST_AUTORUN === "false" || env.NODE_ENV === "test") return false;
  const tick = async () => {
    if (g.__ingestBusy) return;
    g.__ingestBusy = true;
    try {
      const r = await runDueSources();
      for (const x of r.ran) console.log(`[ingest] ${x.name}: ${x.status}. ${x.message}`);
      if (r.hidden) console.log(`[ingest] hid ${r.hidden} stale item(s)`);
    } catch (e) {
      console.error("[ingest] scheduler error:", e instanceof Error ? e.message : "unknown");
    } finally {
      g.__ingestBusy = false;
    }
  };
  const first = setTimeout(() => { void tick(); }, FIRST_MS);
  first.unref();
  g.__ingestTimer = setInterval(() => { void tick(); }, TICK_MS);
  g.__ingestTimer.unref();
  return true;
}
