import { requireAdmin } from "@/lib/auth";
import { savePricingAction } from "@/app/admin/actions";
import { Area, Flash, PageHead, Text } from "@/components/admin/ui";
import { tiersToText } from "@/lib/admin-parse";
import { ghs, minorToInput } from "@/lib/money";
import { effectiveRate, gbpToGhsMinor, serviceFeeMinor } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const s = getSettings();
  const fee = s.serviceFee;
  const mode = fee.mode;
  const examples = [2000, 10000, 50000];

  return (
    <>
      <PageHead title="Pricing" />
      <Flash saved={sp.saved} error={sp.error} />
      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <form action={savePricingAction} className="grid gap-8">
          <section className="box box-shadow grid gap-4 p-5">
            <h2 className="text-2xl">Service charge</h2>
            <p className="hint">
              Added on top of the items. Customers always see it as its own line. Pick one method; only that one is used.
            </p>

            <fieldset className="grid gap-3">
              <legend className="sr-only">Method</legend>

              <div className={`box grid gap-3 p-4 ${mode === "percent" ? "!bg-gold/30" : ""}`}>
                <label className="flex items-center gap-2 font-semibold">
                  <input type="radio" name="feeMode" value="percent" defaultChecked={mode === "percent"} className="h-4 w-4 accent-[var(--green)]" />
                  Percentage of the item total
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Text label="Percent (%)" name="feePercent" inputMode="decimal" defaultValue={fee.mode === "percent" ? fee.percent : 10} />
                  <Text label="Minimum charge (GH₵)" name="feeMin" inputMode="decimal" defaultValue={minorToInput(fee.mode === "percent" ? fee.minMinor : fee.mode === "tiered" ? fee.minMinor : 0)} />
                </div>
              </div>

              <div className={`box grid gap-3 p-4 ${mode === "fixed" ? "!bg-gold/30" : ""}`}>
                <label className="flex items-center gap-2 font-semibold">
                  <input type="radio" name="feeMode" value="fixed" defaultChecked={mode === "fixed"} className="h-4 w-4 accent-[var(--green)]" />
                  Flat amount per order
                </label>
                <Text label="Amount (GH₵)" name="feeFixed" inputMode="decimal" defaultValue={minorToInput(fee.mode === "fixed" ? fee.fixedMinor : 5000)} />
              </div>

              <div className={`box grid gap-3 p-4 ${mode === "tiered" ? "!bg-gold/30" : ""}`}>
                <label className="flex items-center gap-2 font-semibold">
                  <input type="radio" name="feeMode" value="tiered" defaultChecked={mode === "tiered"} className="h-4 w-4 accent-[var(--green)]" />
                  Tiered by the item total in pounds
                </label>
                <Area
                  label="Bands: “pounds, percent” on each line"
                  name="feeTiers"
                  mono
                  rows={4}
                  defaultValue={fee.mode === "tiered" ? tiersToText(fee.tiers) : "50, 15\n150, 12\n500, 10\n*, 8"}
                  hint="“50, 15” means item totals up to £50 pay 15%. End with “*, 8” for everything above."
                />
                <Text label="Minimum charge (GH₵)" name="tierMin" inputMode="decimal" defaultValue={minorToInput(fee.mode === "tiered" ? fee.minMinor : 0)} />
              </div>
            </fieldset>
          </section>

          <section className="box box-shadow grid gap-4 p-5">
            <h2 className="text-2xl">Exchange rate and minimum order</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label="GH₵ for £1" name="fxRate" inputMode="decimal" defaultValue={s.fx.rate} hint="Update this when the market moves." />
              <Text label="Markup on the rate (%)" name="fxMarkup" inputMode="decimal" defaultValue={s.fx.markupPct} hint="Covers rate changes between quote and purchase." />
            </div>
            <Text label="Minimum order, items only (£)" name="minOrder" inputMode="decimal" defaultValue={minorToInput(s.minOrderGbpMinor)} />
          </section>

          <section className="box box-shadow grid gap-4 p-5">
            <h2 className="text-2xl">Site</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label="Site name" name="siteName" defaultValue={s.siteName} required />
              <Text label="WhatsApp number (optional)" name="whatsapp" defaultValue={s.supportWhatsapp} hint="With country code, e.g. 233501234567" />
            </div>
          </section>

          <div><button className="btn btn-primary">Save pricing</button></div>
        </form>

        <aside className="receipt h-fit p-5">
          <h2 className="!text-xl">What customers pay now</h2>
          <p className="mt-2 font-sans text-sm text-ink-soft">Based on the saved settings, before shipping and delivery.</p>
          <p className="mt-3">£1 = GH₵{effectiveRate(s.fx).toFixed(4)}</p>
          <hr />
          {examples.map((p) => {
            const ghsItems = gbpToGhsMinor(p, s.fx);
            const svc = serviceFeeMinor(s.serviceFee, ghsItems, p);
            return (
              <div key={p} className="mb-3">
                <p className="font-semibold">Item £{(p / 100).toFixed(2)}</p>
                <div className="row"><dt>Items</dt><dd className="num">{ghs(ghsItems)}</dd></div>
                <div className="row"><dt>Service charge</dt><dd className="num">{ghs(svc)}</dd></div>
              </div>
            );
          })}
        </aside>
      </div>
    </>
  );
}
