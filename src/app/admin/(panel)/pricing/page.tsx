import { requirePermission } from "@/lib/auth";
import Link from "next/link";
import { savePricingAction } from "@/app/admin/actions";
import { Flash, PageHead, Text } from "@/components/admin/ui";
import { ghs } from "@/lib/money";
import { sampleQuotes } from "@/lib/quote-samples";
import { getSettings } from "@/lib/settings";

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requirePermission("pricing.manage");
  const sp = await searchParams;
  const s = getSettings();
  const samples = sampleQuotes();

  return (
    <>
      <PageHead title="Pricing" />
      <Flash saved={sp.saved} error={sp.error} />
      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <form action={savePricingAction} className="grid gap-8">
          <section className="box box-shadow grid gap-4 p-5">
            <h2 className="text-2xl">Exchange rate</h2>
            <p className="hint">
              The service charge, shipping, insurance, import duties and delivery all come from the{" "}
              <Link href="/admin/pricing-engine" className="link">pricing engine</Link>. Here you only keep the rates up to date.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label="Market rate: GH₵ for £1" name="fxRate" inputMode="decimal" defaultValue={s.market.mid} hint={`Update this when the market moves. Customers are charged GH₵${s.fx.rate.toFixed(4)}, which adds the pricing engine's safety margin.`} />
              <Text label="Customs rate: GH₵ for £1 (optional)" name="customsRate" inputMode="decimal" defaultValue={s.customsSource === "manual" ? s.market.customs : ""} hint={s.customsSource === "bank_of_ghana" ? `Leave empty to use the Bank of Ghana rate, GH₵${s.market.customs} now. Fill it in only to override it.` : "The rate customs use to value the goods at the port. Leave empty to use the Bank of Ghana rate once it has been read, or the market rate until then."} />
            </div>
          </section>

          <section className="box box-shadow grid gap-4 p-5">
            <h2 className="text-2xl">Site</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label="Site name" name="siteName" defaultValue={s.siteName} required />
              <Text label="WhatsApp number (optional)" name="whatsapp" defaultValue={s.supportWhatsapp} hint="With country code, e.g. 233501234567" />
              <Text label="Contact email (for privacy and complaints)" name="supportEmail" type="email" defaultValue={s.supportEmail} hint="Shown in the privacy policy and terms. Fill this in before you submit the policy links to Facebook or Google." />
              <Text label="Registered business name (optional)" name="legalName" defaultValue={s.legalName} hint="The company that runs the shop, if different from the site name, for example Atombo Logistics Ltd." />
            </div>
          </section>

          <div><button className="btn btn-primary">Save pricing</button></div>
        </form>

        <aside className="receipt h-fit p-5">
          <h2 className="!text-xl">What customers pay now</h2>
          <p className="mt-2 font-sans text-sm text-ink-soft">Typical baskets to Accra, with the saved settings. “Items” includes the service charge.</p>
          <p className="mt-3">£1 = GH₵{s.fx.rate.toFixed(4)}</p>
          <hr />
          {samples.map((q) => (
            <div key={q.name} className="mb-3">
              <p className="font-semibold">{q.name}</p>
              <div className="row"><dt>Items</dt><dd className="num">{ghs(q.items)}</dd></div>
              <div className="row"><dt>Delivery, insurance and import duties</dt><dd className="num">{ghs(q.deliveryAndImport)}</dd></div>
              <div className="row"><dt>Total</dt><dd className="num">{ghs(q.total)}</dd></div>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
