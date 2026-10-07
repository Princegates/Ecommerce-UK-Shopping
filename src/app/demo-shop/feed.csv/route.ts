import { demoBase, demoDay, demoEnabled, demoFeedCsv } from "@/lib/demo-shop";

export const dynamic = "force-dynamic";

/** A sample affiliate-style product feed. Add ?day=2 to see the same shop a day later. */
export async function GET(req: Request) {
  if (!demoEnabled()) return new Response("Not found", { status: 404 });
  const day = demoDay(new URL(req.url).searchParams.get("day"));
  return new Response(demoFeedCsv(demoBase(req), day), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "X-Robots-Tag": "noindex", "Cache-Control": "no-store" },
  });
}
