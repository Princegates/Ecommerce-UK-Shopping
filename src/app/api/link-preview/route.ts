import { NextResponse } from "next/server";
import { clientKey } from "@/lib/auth";
import { parseAmazonLink } from "@/lib/amazon-links";
import { findListedProductByUrl } from "@/lib/ingest/store";
import { lookupLink } from "@/lib/ingest/run";
import { getItemTypes } from "@/lib/link-auto";
import { gbpToGhsMinor } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { createLimiter } from "@/lib/throttle";

export const dynamic = "force-dynamic";

const limiter = createLimiter(12, 10 * 60 * 1000);

/**
 * Looks at one product link for the "request an item" form: is it already on the site, or can we read its name and
 * price? Nothing is saved. Limited per visitor, obeys robots.txt, and never reaches private addresses.
 */
export async function GET(req: Request) {
  const url = (new URL(req.url).searchParams.get("url") ?? "").trim().slice(0, 1000);
  const none = (reason: string) => NextResponse.json({ ok: false, reason }, { headers: { "Cache-Control": "no-store" } });
  if (!/^https?:\/\//i.test(url)) return none("invalid");
  const key = `link-preview:${await clientKey()}`;
  if (!limiter.allowed(key)) return NextResponse.json({ ok: false, reason: "slow-down" }, { status: 429 });
  limiter.record(key);

  const listed = findListedProductByUrl(url);
  if (listed) return NextResponse.json({ ok: true, onSite: listed }, { headers: { "Cache-Control": "no-store" } });

  // Amazon does not let the shop read its pages, and the shop does not try. The form recognises the link itself and asks for the price.
  if (parseAmazonLink(url)) return none("amazon");

  const r = await lookupLink(url);
  if (!r.ok) return none(r.reason);
  return NextResponse.json(
    {
      ok: true, name: r.item.name, priceMinor: r.item.priceMinor, priceGhsMinor: gbpToGhsMinor(r.item.priceMinor, getSettings().fx), imageUrl: r.item.imageUrl,
      host: new URL(url).hostname, itemTypes: getItemTypes().map((t) => t.name),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
