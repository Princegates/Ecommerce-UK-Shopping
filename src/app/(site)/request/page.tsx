import type { Metadata } from "next";
import RequestForm from "@/components/RequestForm";
import { normalizeRequestUrl } from "@/lib/amazon-links";
import { getCustomer } from "@/lib/customer-session";
import { getItemTypes } from "@/lib/link-auto";

export const metadata: Metadata = { title: "Request any item" };

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ url?: string; title?: string; price?: string; img?: string }> }) {
  const sp = await searchParams;
  const clean = (v: string | undefined, max: number) => (v ?? "").slice(0, max);
  const shared = normalizeRequestUrl(clean(sp.url, 1000)).url;
  const url = /^https?:\/\//i.test(shared) ? shared.slice(0, 500) : "";
  // only a picture hosted by Amazon is shown, so a made-up link cannot put anything else on the page
  const imageUrl = /^https:\/\/m\.media-amazon\.com\/images\/[\w./%+-]{1,300}$/.test(sp.img ?? "") ? sp.img! : "";
  const c = await getCustomer();
  return <RequestForm itemTypes={getItemTypes().map((t) => t.name)} signedIn={Boolean(c)} initial={{ name: c?.name ?? "", phone: c?.phone ?? "", email: c?.email ?? "", url, imageUrl, title: clean(sp.title, 160), priceSeen: /^\d{1,6}(\.\d{1,2})?$/.test(sp.price ?? "") ? sp.price! : "" }} />;
}
