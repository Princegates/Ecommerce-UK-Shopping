import { demoBase, demoEnabled, demoSitemapXml } from "@/lib/demo-shop";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!demoEnabled()) return new Response("Not found", { status: 404 });
  return new Response(demoSitemapXml(demoBase(req)), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "X-Robots-Tag": "noindex", "Cache-Control": "no-store" },
  });
}
