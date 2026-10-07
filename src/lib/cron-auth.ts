import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Guards the scheduled-job endpoints. Returns a response to send back when the call must be
 * refused, or null when it is allowed. Disabled (404) until CRON_SECRET is set.
 */
export function refuseUnlessCron(req: Request, env: NodeJS.ProcessEnv = process.env): NextResponse | null {
  const secret = env.CRON_SECRET;
  if (!secret || secret.length < 16) return NextResponse.json({ error: "not found" }, { status: 404 });
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}
