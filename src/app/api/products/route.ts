import { NextResponse } from "next/server";
import { productsByIds } from "@/lib/catalog";
import { gbpToGhsMinor } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Basic card details for a handful of product ids, used by the "recently viewed" shelf. */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").slice(0, 24).map(Number);
  const fx = getSettings().fx;
  return NextResponse.json(
    productsByIds(ids).map((p) => ({
      id: p.id, slug: p.slug, name: p.name, shop: p.shopName, accent: p.shopAccent, imageUrl: p.imageUrl, priceMinor: gbpToGhsMinor(p.priceMinor, fx), gbpMinor: p.priceMinor,
      wasMinor: p.compareAtMinor ? gbpToGhsMinor(p.compareAtMinor, fx) : null,
    })),
    { headers: { "Cache-Control": "no-store" } },
  );
}
