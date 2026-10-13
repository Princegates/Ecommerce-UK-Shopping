import { NextResponse } from "next/server";
import { getCart, readCartToken } from "@/lib/cart";
import { db } from "@/lib/db";
import { quoteMarket } from "@/lib/rate-lock";
import { gbpToGhsMinor } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** What the mini-cart drawer shows. Reads the visitor's own cart cookie only. */
export async function GET() {
  const lines = await getCart();
  const s = getSettings();
  // the price held for this shopper if there is one; just looking at the drawer does not start a hold
  const fx = quoteMarket(await readCartToken(), db(), new Date(), { create: false }).fx;
  const itemsGbp = lines.reduce((n, l) => n + l.product.priceMinor * l.quantity, 0);
  return NextResponse.json(
    {
      count: lines.reduce((n, l) => n + l.quantity, 0),
      itemsGbpMinor: itemsGbp,
      itemsGhsMinor: gbpToGhsMinor(itemsGbp, fx),
      minOrderMinor: Math.round(s.pricing.minOrderGhs * 100),
      items: lines.map((l) => ({
        id: l.itemId, slug: l.product.slug, name: l.product.name, shop: l.product.shopName, accent: l.product.shopAccent, imageUrl: l.product.imageUrl,
        quantity: l.quantity, options: Object.values(l.options).join(" / "), lineGhsMinor: gbpToGhsMinor(l.product.priceMinor * l.quantity, fx),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
