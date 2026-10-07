import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BuyBox from "@/components/BuyBox";
import ProductArt from "@/components/ProductArt";
import ProductCard from "@/components/ProductCard";
import { getProduct, relatedProducts } from "@/lib/catalog";
import { MAX_ITEM_QUANTITY } from "@/lib/cart";
import { getSettings, getShippingMethods, getZones } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getProduct((await params).slug);
  return { title: p ? p.name : "Item not found", description: p?.description };
}

export default async function ProductPage({ params }: Props) {
  const product = getProduct((await params).slug);
  if (!product) notFound();

  const settings = getSettings();
  const methods = getShippingMethods();
  const zones = getZones();
  const related = relatedProducts(product, 4);
  const cfg = {
    fx: settings.fx,
    serviceFee: settings.serviceFee,
    methods: methods.map((m) => ({ code: m.code, name: m.name, eta: m.eta, rateCard: m.rateCard })),
    zones: zones.map((z) => ({ id: z.id, name: z.name, areas: z.areas, feeMinor: z.feeMinor, eta: z.eta })),
  };

  const details: [string, string][] = [
    ["Sold by", product.shopName],
    ["Brand", product.brand || "—"],
    ["Category", product.category || "—"],
    ["Weight", `${(product.weightGrams / 1000).toFixed(product.weightGrams % 1000 === 0 ? 0 : 2)} kg (used to work out shipping)`],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="label">
        <Link href="/shops" className="hover:underline">Shops</Link> /{" "}
        <Link href={`/shops/${product.shopSlug}`} className="hover:underline">{product.shopName}</Link>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="box box-shadow overflow-hidden">
            <ProductArt name={product.name} accent={product.shopAccent} imageUrl={product.imageUrl} />
            <div className="flex flex-wrap items-center gap-3 p-4">
              <span className="tag tag-gold">{product.category || "Item"}</span>
              <Link href={`/shops/${product.shopSlug}`} className="link font-semibold">
                More from {product.shopName}
              </Link>
            </div>
          </div>

          <section className="mt-10">
            <h2 className="text-2xl">About this item</h2>
            <p className="mt-3 max-w-2xl text-lg">{product.description || "No description yet."}</p>
            <dl className="mt-6 max-w-2xl border-t-2 border-ink">
              {details.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[8rem_1fr] gap-4 border-b border-ink/30 py-3">
                  <dt className="label self-center">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {product.sourceUrl && (
              <p className="mt-4 text-sm">
                <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer" className="link">
                  See this item on the shop&rsquo;s own website ↗
                </a>
              </p>
            )}
          </section>
        </div>

        <div className="lg:sticky lg:top-44 lg:self-start">
          <p className="label">{product.shopName}</p>
          <h1 className="mt-1 text-[clamp(2rem,4.5vw,3.2rem)]">{product.name}</h1>
          {product.brand && <p className="mt-1 text-ink-soft">by {product.brand}</p>}
          <div className="mt-6">
            <BuyBox
              product={{
                id: product.id,
                name: product.name,
                priceMinor: product.priceMinor,
                weightGrams: product.weightGrams,
                options: product.options,
              }}
              cfg={cfg}
              maxQty={MAX_ITEM_QUANTITY}
            />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-3xl">More from {product.shopName}</h2>
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {related.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} fx={settings.fx} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
