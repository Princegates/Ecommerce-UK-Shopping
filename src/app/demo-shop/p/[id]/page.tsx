import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { demoBase, demoEnabled, demoRows } from "@/lib/demo-shop";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demo UK shop product", robots: { index: false, follow: false } };

/** A product page the way a real UK shop publishes one: visible details plus machine-readable product data. */
export default async function DemoProduct({ params }: { params: Promise<{ id: string }> }) {
  if (!demoEnabled()) notFound();
  const { id } = await params;
  const p = demoRows(1).find((x) => x.id === id);
  if (!p) notFound();
  const base = demoBase();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    sku: p.id,
    brand: { "@type": "Brand", name: "Harbour & Pine" },
    category: p.category,
    image: [`${base}/products/demo/${p.id}.svg`],
    offers: {
      "@type": "Offer",
      price: p.price.toFixed(2),
      priceCurrency: "GBP",
      availability: p.stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      ...(p.rrp ? { priceSpecification: [{ "@type": "UnitPriceSpecification", priceType: "https://schema.org/ListPrice", price: p.rrp.toFixed(2), priceCurrency: "GBP" }, { "@type": "UnitPriceSpecification", price: p.price.toFixed(2), priceCurrency: "GBP" }] } : {}),
    },
  };
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <p className="rounded-lg bg-spark/50 p-3 text-sm font-bold">Demo page. This pretend UK shop exists only to show how the catalogue importer reads product pages.</p>
      <div className="mt-6 grid gap-6 rounded-2xl bg-white p-6 sm:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/products/demo/${p.id}.svg`} alt={p.name} className="w-full rounded-xl border border-line" />
        <div>
          <p className="text-sm text-ink-soft">Harbour &amp; Pine · {p.category}</p>
          <h1 className="mt-1 text-2xl font-bold">{p.name}</h1>
          <p className="mt-3 text-3xl font-bold">£{p.price.toFixed(2)}{p.rrp && <span className="was ml-3 text-base font-normal">£{p.rrp.toFixed(2)}</span>}</p>
          <p className="mt-1 text-sm font-bold text-green">{p.stock ? "In stock" : "Out of stock"}</p>
          <p className="mt-4">{p.description}</p>
        </div>
      </div>
    </main>
  );
}
