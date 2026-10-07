import { NextResponse } from "next/server";
import { refuseUnlessCron } from "@/lib/cron-auth";
import { processOutbox } from "@/lib/notify/outbox";

export const dynamic = "force-dynamic";

/**
 * Retry any queued messages. Call it every few minutes from a scheduler:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron/messages
 * Disabled (404) until CRON_SECRET is set.
 */
async function handle(req: Request) {
  const refused = refuseUnlessCron(req);
  if (refused) return refused;
  return NextResponse.json(await processOutbox());
}

export const GET = handle;
export const POST = handle;
