import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { demoBase, demoEnabled } from "@/lib/demo-shop";
import { DEMO_PRODUCTS } from "@/lib/demo-shop-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demo UK shop", robots: { index: false, follow: false } };

export default function DemoShopIndex() {
  if (!demoEnabled()) notFound();
  const base = demoBase();
  const code = "mono rounded bg-paper-2 px-1.5 py-0.5 text-sm break-all";
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(16,20,18,0.12)]">
        <h1 className="text-2xl font-bold">Demo UK shop: try the catalogue importer</h1>
        <p className="mt-2 text-ink-soft">
          This is a pretend UK shop ({DEMO_PRODUCTS.length} products) hosted on your own site, so you can watch the importer work for real without touching a real retailer.
        </p>
        <h2 className="mt-6 text-lg font-bold">Try it in 4 steps</h2>
        <ol className="mt-2 grid list-decimal gap-2 pl-5">
          <li>In the admin, open <strong>Catalogue sources → Add a source</strong>. Pick a shop to put the items in (add a shop called “Demo UK Shop” first if you like).</li>
          <li>Choose <strong>Product feed (CSV)</strong> and paste <span className={code}>{base}/demo-shop/feed.csv</span></li>
          <li>Tick the permission box, click <strong>Check this setup first</strong> to preview, then <strong>Create source</strong> and <strong>Run now</strong>.</li>
          <li>Open the shop. The products are there with photos, prices and was-prices.</li>
        </ol>
        <h2 className="mt-6 text-lg font-bold">See changes handled</h2>
        <p className="mt-1">Edit the source and change the address to <span className={code}>{base}/demo-shop/feed.csv?day=2</span>, then <strong>Run now</strong> again. One price updates by itself, a doubled price waits in <strong>Import review</strong>, an item that left the feed is hidden, and a new item arrives with no photo.</p>
        <h2 className="mt-6 text-lg font-bold">See page reading</h2>
        <p className="mt-1">Add another source of type <strong>Shop website (sitemap + product pages)</strong> with <span className={code}>{base}/demo-shop/sitemap.xml</span>. The importer reads the sitemap, obeys robots.txt, waits between pages, and reads each page&rsquo;s product data. Open <strong>Run history</strong> to watch it.</p>
        <p className="mt-6 text-sm text-ink-soft">The pages below are what the importer reads.</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {DEMO_PRODUCTS.map((p) => <li key={p.id}><Link className="link" href={`/demo-shop/p/${p.id}`}>{p.name}</Link></li>)}
        </ul>
        <p className="mt-6 text-xs text-ink-soft">Switch this demo off with <span className="mono">DISABLE_DEMO_SHOP=true</span>.</p>
      </div>
    </main>
  );
}
