import type { Metadata } from "next";
import BrowseView from "@/components/shop/BrowseView";
import { parseBrowse } from "@/lib/browse";
import { getShopper } from "@/lib/shopper";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const p = parseBrowse(sp);
  const shopper = await getShopper();
  const heading = p.q ? `Results for “${p.q}”` : p.deals ? "Today’s deals" : p.sort === "newest" ? "New arrivals" : "All items";
  return <BrowseView basePath="/search" searchParams={sp} shopper={shopper} heading={heading} />;
}
