import { NextResponse } from "next/server";
import { refuseUnlessCron } from "@/lib/cron-auth";
import { syncRates } from "@/lib/fx-api";

export const dynamic = "force-dynamic";

/**
 * Refresh the market exchange rate and, if automatic mode is on and the move is within your limit, apply it.
 * Call it once or twice a day from a scheduler:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron/fx
 */
async function handle(req: Request) {
  const refused = refuseUnlessCron(req);
  if (refused) return refused;
  const r = await syncRates();
  return NextResponse.json(r.ok ? { ok: true, rate: r.rate, applied: r.applied, reason: r.reason } : { ok: false, error: r.error }, { status: r.ok ? 200 : 502 });
}

export const GET = handle;
export const POST = handle;
