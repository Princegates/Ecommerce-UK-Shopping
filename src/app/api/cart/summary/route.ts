import { NextResponse } from "next/server";
import { getCart } from "@/lib/cart";
import { gbpToGhsMinor } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** What the mini-cart drawer shows. Reads the visitor's own cart cookie only. */
export async function GET() {
  const lines = await getCart();
  const s = getSettings();
  const itemsGbp = lines.reduce((n, l) => n + l.product.priceMinor * l.quantity, 0);
  return NextResponse.json(
    {
      count: lines.reduce((n, l) => n + l.quantity, 0),
      itemsGbpMinor: itemsGbp,
      itemsGhsMinor: gbpToGhsMinor(itemsGbp, s.fx),
      minOrderGbpMinor: s.minOrderGbpMinor,
      items: lines.map((l) => ({
        id: l.itemId, slug: l.product.slug, name: l.product.name, shop: l.product.shopName, accent: l.product.shopAccent, imageUrl: l.product.imageUrl,
        quantity: l.quantity, options: Object.values(l.options).join(" / "), lineGhsMinor: gbpToGhsMinor(l.product.priceMinor * l.quantity, s.fx),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
