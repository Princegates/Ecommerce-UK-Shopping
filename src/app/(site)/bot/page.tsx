import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "About our catalogue reader" };

export default function BotPage() {
  const { siteName, supportWhatsapp } = getSettings();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(15,17,17,0.12)]">
        <h1 className="text-2xl font-bold">About ShopCatalogBot</h1>
        <p className="mt-3">
          {siteName} lets shoppers in Ghana buy from UK shops. To show accurate names, prices and stock, our catalogue reader
          (<span className="mono">ShopCatalogBot</span>) reads product information from shops that have given us a feed or whose terms allow it.
        </p>
        <h2 className="mt-6 text-lg font-bold">How it behaves</h2>
        <ul className="mt-2 grid list-disc gap-1 pl-5">
          <li>It identifies itself as <span className="mono">ShopCatalogBot</span> and links to this page.</li>
          <li>It follows your <span className="mono">robots.txt</span>, including <span className="mono">Crawl-delay</span>, and waits at least a few seconds between requests.</li>
          <li>It reads one page at a time and only product pages, never baskets, accounts or checkouts.</li>
          <li>If your site answers with an error, a block or a verification page, it stops and does not try again with another identity.</li>
        </ul>
        <h2 className="mt-6 text-lg font-bold">Want it to stop, or to send a feed instead?</h2>
        <p className="mt-2">
          Add <span className="mono">User-agent: ShopCatalogBot</span> with <span className="mono">Disallow: /</span> to your robots.txt and it will not read your site.
          If you would rather give us an official product feed, that is better for everyone. Contact us{supportWhatsapp ? <> on WhatsApp at {supportWhatsapp}</> : null}.
        </p>
      </div>
    </div>
  );
}
