import { NextResponse } from "next/server";
import { refuseUnlessCron } from "@/lib/cron-auth";
import { runDueSources } from "@/lib/ingest/run";

export const dynamic = "force-dynamic";

/**
 * Run every catalogue source that is switched on and due, then hide stale items. The built-in scheduler already
 * does this every few minutes; call this from your own scheduler if you turn that off (INGEST_AUTORUN=false):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron/ingest
 */
async function handle(req: Request) {
  const refused = refuseUnlessCron(req);
  if (refused) return refused;
  return NextResponse.json(await runDueSources());
}

export const GET = handle;
export const POST = handle;
