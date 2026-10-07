import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BuyBox from "@/components/BuyBox";
import ProductArt from "@/components/ProductArt";
import RecentlyViewed, { TrackView } from "@/components/shop/RecentlyViewed";
import ProductShelf from "@/components/shop/ProductShelf";
import Reviews from "@/components/shop/Reviews";
import Stars from "@/components/shop/Stars";
import WishlistButton from "@/components/shop/WishlistButton";
import { MAX_ITEM_QUANTITY } from "@/lib/cart";
import { getProduct, isDealLive, relatedProducts } from "@/lib/catalog";
import { appUrl } from "@/lib/app-url";
import { getSettings, getShippingMethods, getZones } from "@/lib/settings";
import { gbpToGhsMinor } from "@/lib/pricing";
import { getShopper } from "@/lib/shopper";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getProduct((await params).slug);
  return { title: p ? p.name : "Item not found", description: p?.description, openGraph: p ? { title: p.name, description: p.description } : undefined };
}

const TRUST = [
  ["Secure payment", "Pay on the provider's own page. We never see your card or PIN."],
  ["Tracked end to end", "Watch it move from the UK shop to your door in your account."],
  ["We buy it for you", "No UK card, UK address or forms."],
] as const;

export default async function ProductPage({ params }: Props) {
  const product = getProduct((await params).slug);
  if (!product) notFound();

  const shopper = await getShopper();
  const { fx } = shopper;
  const methods = getShippingMethods();
  const zones = getZones();
  const related = relatedProducts(product, 10);
  const deal = isDealLive(product);
  const cfg = {
    fx,
    serviceFee: getSettings().serviceFee,
    methods: methods.map((m) => ({ code: m.code, name: m.name, eta: m.eta, rateCard: m.rateCard })),
    zones: zones.map((z) => ({ id: z.id, name: z.name, areas: z.areas, feeMinor: z.feeMinor, eta: z.eta })),
  };

  const details: [string, string][] = [
    ["Sold by", product.shopName],
    ["Brand", product.brand || "—"],
    ["Category", product.category || "—"],
    ["Weight", `${(product.weightGrams / 1000).toFixed(product.weightGrams % 1000 === 0 ? 0 : 2)} kg (used to work out shipping)`],
  ];

  const base = appUrl();
  const share = base ? `https://wa.me/?text=${encodeURIComponent(`${product.name} ${base}/products/${product.slug}`)}` : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    category: product.category,
    ...(product.imageUrl ? { image: product.imageUrl } : {}),
    offers: { "@type": "Offer", priceCurrency: "GHS", price: (gbpToGhsMinor(product.priceMinor, fx) / 100).toFixed(2), availability: "https://schema.org/InStock", ...(base ? { url: `${base}/products/${product.slug}` } : {}) },
    ...(product.reviewCount > 0 && product.ratingAvg ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.ratingAvg, reviewCount: product.reviewCount } } : {}),
  };

  return (
    <>
      <TrackView productId={product.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <nav aria-label="Breadcrumb" className="label">
          <Link href="/" className="hover:underline">Home</Link> / <Link href="/shops" className="hover:underline">Shops</Link> /{" "}
          <Link href={`/shops/${product.shopSlug}`} className="hover:underline">{product.shopName}</Link>
        </nav>

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="box box-shadow relative overflow-hidden">
              <ProductArt name={product.name} accent={product.shopAccent} imageUrl={product.imageUrl} />
              {deal && <span className="badge badge-deal left-3 top-3 !text-sm">Deal</span>}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="tag tag-gold">{product.category || "Item"}</span>
                  <Link href={`/shops/${product.shopSlug}`} className="link font-semibold">More from {product.shopName}</Link>
                </div>
                <div className="flex items-center gap-2">
                  <WishlistButton productId={product.id} saved={shopper.saved.has(product.id)} />
                  {share && <a href={share} target="_blank" rel="noopener noreferrer" className="btn btn-small">Share on WhatsApp</a>}
                </div>
              </div>
            </div>

            <ul className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Why buy here">
              {TRUST.map(([t, b]) => (
                <li key={t} className="box p-3"><p className="text-sm font-bold">{t}</p><p className="mt-0.5 text-xs text-ink-soft">{b}</p></li>
              ))}
            </ul>

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
                  <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer" className="link">See this item on the shop&rsquo;s own website ↗</a>
                </p>
              )}
            </section>
          </div>

          <div className="lg:sticky lg:top-44 lg:self-start">
            <p className="label">{product.shopName}</p>
            <h1 className="mt-1 text-[clamp(2rem,4.5vw,3.2rem)]">{product.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              {product.brand && <p className="text-ink-soft">by {product.brand}</p>}
              {product.reviewCount > 0 ? (
                <a href="#reviews" className="hover:underline"><Stars value={product.ratingAvg} count={product.reviewCount} /></a>
              ) : (
                <a href="#reviews" className="link text-sm">No reviews yet</a>
              )}
            </div>
            {shopper.ctx && (
              <p className="mt-3 text-sm">
                <span className="font-bold">Delivered to {shopper.ctx.zoneName}</span>
                <span className="text-ink-soft"> by {shopper.ctx.methodName.toLowerCase()}{methods[0]?.eta ? `, ${methods[0].eta}` : ""}. Change your area at the top of the page.</span>
              </p>
            )}
            <div className="mt-6">
              <BuyBox
                product={{ id: product.id, name: product.name, priceMinor: product.priceMinor, weightGrams: product.weightGrams, options: product.options }}
                cfg={cfg}
                maxQty={MAX_ITEM_QUANTITY}
                compareAtMinor={deal ? product.compareAtMinor : null}
                dealEndsAt={deal ? product.dealEndsAt : null}
              />
            </div>
          </div>
        </div>

        <div className="mt-16"><Reviews productId={product.id} slug={product.slug} customer={shopper.customer} /></div>
      </div>

      <ProductShelf id="related" title={`More from ${product.shopName}`} products={related} shopper={shopper} href={`/shops/${product.shopSlug}`} linkLabel="Visit the shop" />
      <RecentlyViewed excludeId={product.id} />
    </>
  );
}
