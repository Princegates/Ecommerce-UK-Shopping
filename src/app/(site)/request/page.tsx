import type { Metadata } from "next";
import RequestForm from "@/components/RequestForm";
import { getCustomer } from "@/lib/customer-session";
import { getItemTypes } from "@/lib/link-auto";

export const metadata: Metadata = { title: "Request an item by link" };

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ url?: string; title?: string; price?: string }> }) {
  const sp = await searchParams;
  const clean = (v: string | undefined, max: number) => (v ?? "").slice(0, max);
  const url = /^https?:\/\//i.test(sp.url ?? "") ? clean(sp.url, 1000) : "";
  const c = await getCustomer();
  return <RequestForm itemTypes={getItemTypes().map((t) => t.name)} signedIn={Boolean(c)} initial={{ name: c?.name ?? "", phone: c?.phone ?? "", email: c?.email ?? "", url, title: clean(sp.title, 160), priceSeen: /^\d{1,6}(\.\d{1,2})?$/.test(sp.price ?? "") ? sp.price! : "" }} />;
}
