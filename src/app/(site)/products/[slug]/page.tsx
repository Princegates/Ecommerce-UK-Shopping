import type { Metadata } from "next";
import Link from "next/link";
import ShopLogo from "@/components/ShopLogo";
import { notFound } from "next/navigation";
import BuyBox from "@/components/BuyBox";
import Price from "@/components/Price";
import ProductArt from "@/components/ProductArt";
import Countdown from "@/components/shop/Countdown";
import RecentlyViewed, { TrackView } from "@/components/shop/RecentlyViewed";
import ProductShelf from "@/components/shop/ProductShelf";
import Reviews from "@/components/shop/Reviews";
import Stars from "@/components/shop/Stars";
import WishlistButton from "@/components/shop/WishlistButton";
import { MAX_ITEM_QUANTITY } from "@/lib/cart";
import { dealPercent, getProduct, isDealLive, relatedProducts } from "@/lib/catalog";
import { landedMinor } from "@/lib/landed";
import { gbp, ghs } from "@/lib/money";
import { appUrl } from "@/lib/app-url";
import { getSettings, getShippingMethods, getZones } from "@/lib/settings";
import { gbpToGhsMinor, ghsToGbpMinor } from "@/lib/pricing";
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

  const was = deal ? product.compareAtMinor : null;
  const saveGbp = was ? was - product.priceMinor : 0;
  const door = shopper.ctx ? landedMinor(product, shopper.ctx) : null;

  return (
    <>
      <TrackView productId={product.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-[90rem] px-3 py-4 md:px-4">
        <nav aria-label="Breadcrumb" className="text-xs text-ink-soft">
          <Link href="/" className="hover:text-link-hover hover:underline">Home</Link> › <Link href="/shops" className="hover:text-link-hover hover:underline">Shops</Link> ›{" "}
          <Link href={`/shops/${product.shopSlug}`} className="hover:text-link-hover hover:underline">{product.shopName}</Link>
        </nav>

        <div className="mt-3 grid gap-5 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,17,17,0.12)] md:p-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)_21rem]">
          <div className="lg:sticky lg:top-36 lg:self-start">
            <div className="relative overflow-hidden rounded-lg border border-line">
              <ProductArt name={product.name} accent={product.shopAccent} imageUrl={product.imageUrl} category={product.category} />
              {deal && <span className="badge badge-deal left-3 top-3 !text-sm">-{dealPercent(product)}% deal</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="tag">{product.category || "Item"}</span>
              <div className="flex items-center gap-2">
                <WishlistButton productId={product.id} saved={shopper.saved.has(product.id)} />
                {share && <a href={share} target="_blank" rel="noopener noreferrer" className="btn btn-small">Share on WhatsApp</a>}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <Link href={`/shops/${product.shopSlug}`} className="link inline-flex items-center gap-2 text-sm">
              {product.shopLogoUrl && <ShopLogo shop={{ name: product.shopName, accent: product.shopAccent, logoUrl: product.shopLogoUrl }} className="h-7 w-7 text-xs" />}
              Visit the {product.shopName} shop ›
            </Link>
            <h1 className="mt-1 text-2xl font-medium leading-snug">{product.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {product.brand && <p className="text-ink-soft">Brand: <span className="text-link">{product.brand}</span></p>}
              {product.reviewCount > 0 ? (
                <a href="#reviews" className="hover:underline"><Stars value={product.ratingAvg} count={product.reviewCount} /></a>
              ) : (
                <a href="#reviews" className="link">No reviews yet</a>
              )}
            </div>
            <hr className="my-3 border-line" />
            {saveGbp > 0 && <p className="mb-1 text-sm font-bold text-red">Limited-time deal{product.dealEndsAt && <> · ends in <Countdown endsAt={product.dealEndsAt} /></>}</p>}
            <Price gbpMinor={product.priceMinor} wasGbpMinor={was} fx={fx} size="lg" />
            {saveGbp > 0 && (
              <p className="mt-2 inline-block rounded bg-spark px-2 py-0.5 text-sm font-bold">You save {gbp(saveGbp)} · {ghs(gbpToGhsMinor(saveGbp, fx))}</p>
            )}
            <p className="mt-2 text-xs text-ink-soft">The price above is for the item only, at today&rsquo;s rate. Service charge, shipping and delivery are shown on the right before you pay.</p>
            {door !== null && shopper.ctx && (
              <p className="mt-3 text-sm">
                <span className="font-bold text-green">{ghs(door)} (about {gbp(ghsToGbpMinor(door, fx))}) delivered to {shopper.ctx.zoneName}</span>
                <span className="text-ink-soft"> by {shopper.ctx.methodName.toLowerCase()}{methods[0]?.eta ? `, ${methods[0].eta}` : ""}. Change your area at the top of the page.</span>
              </p>
            )}

            <ul className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Why buy here">
              {TRUST.map(([t, b]) => (
                <li key={t} className="rounded-lg border border-line p-3"><p className="text-sm font-bold">{t}</p><p className="mt-0.5 text-xs text-ink-soft">{b}</p></li>
              ))}
            </ul>

            <section className="mt-5">
              <h2 className="text-lg font-bold">About this item</h2>
              <p className="mt-2 max-w-2xl">{product.description || "No description yet."}</p>
              <table className="mt-4 w-full max-w-2xl text-sm">
                <tbody>
                  {details.map(([k, v]) => (
                    <tr key={k} className="border-t border-line first:border-0">
                      <th scope="row" className="w-36 py-2 pr-3 text-left font-bold">{k}</th>
                      <td className="py-2">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {product.sourceUrl && (
                <p className="mt-3 text-sm">
                  <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="link">See this item on the shop&rsquo;s own website ↗</a>
                </p>
              )}
            </section>
          </div>

          <div className="lg:sticky lg:top-36 lg:self-start">
            <BuyBox
              product={{ id: product.id, name: product.name, priceMinor: product.priceMinor, weightGrams: product.weightGrams, options: product.options }}
              cfg={cfg}
              maxQty={MAX_ITEM_QUANTITY}
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,17,17,0.12)] md:p-6"><Reviews productId={product.id} slug={product.slug} customer={shopper.customer} /></div>
      </div>

      <ProductShelf id="related" title={`More from ${product.shopName}`} products={related} shopper={shopper} href={`/shops/${product.shopSlug}`} linkLabel="Visit the shop" />
      <RecentlyViewed excludeId={product.id} />
    </>
  );
}
