import { NextResponse } from "next/server";
import { clientKey } from "@/lib/auth";
import { departmentSlug, listDepartments, listShops, queryProducts } from "@/lib/catalog";
import { gbpToGhsMinor } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { createLimiter } from "@/lib/throttle";

export const dynamic = "force-dynamic";

const limiter = createLimiter(120, 60_000);

/** Type-ahead for the search box: a few matching items, shops and departments. */
export async function GET(req: Request) {
  const key = `suggest:${await clientKey()}`;
  if (!limiter.allowed(key)) return NextResponse.json({ error: "slow down" }, { status: 429 });
  limiter.record(key);

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ products: [], shops: [], departments: [] });
  const fx = getSettings().fx;
  const needle = q.toLowerCase();
  return NextResponse.json(
    {
      products: queryProducts({ q, limit: 6 }).items.map((p) => ({
        name: p.name, slug: p.slug, shop: p.shopName, accent: p.shopAccent, imageUrl: p.imageUrl, priceMinor: gbpToGhsMinor(p.priceMinor, fx),
      })),
      shops: listShops().filter((s) => `${s.name} ${s.tagline}`.toLowerCase().includes(needle)).slice(0, 3).map((s) => ({ name: s.name, slug: s.slug, category: s.category })),
      departments: listDepartments().filter((d) => d.name.toLowerCase().includes(needle)).slice(0, 3).map((d) => ({ name: d.name, slug: departmentSlug(d.name) })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
