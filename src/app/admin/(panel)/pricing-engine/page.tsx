import { requirePermission } from "@/lib/auth";
import Link from "next/link";
import { resetPricingEngineAction, savePricingEngineAction } from "@/app/admin/actions";
import { Area, Check, Flash, PageHead, Select, Text } from "@/components/admin/ui";
import { ghs } from "@/lib/money";
import { describeFlags } from "@/lib/order-flags";
import { customerOf, priceOrder } from "@/lib/price-order";
import { getSettings, getZones } from "@/lib/settings";

type SP = { saved?: string; error?: string; gbp?: string; kg?: string; qty?: string; cat?: string; zone?: string };

export default async function PricingEnginePage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("pricing.manage");
  const sp = await searchParams;
  const s = getSettings();
  const zones = getZones(true);
  const cfg = s.pricing;

  // the tester
  const gbp = Number(sp.gbp);
  const kg = Number(sp.kg);
  const qty = Math.max(1, Math.min(50, Math.trunc(Number(sp.qty)) || 1));
  const cat = cfg.categories.some((k) => k.id === sp.cat) ? (sp.cat as string) : "unknown";
  const zoneKey = sp.zone && sp.zone in cfg.delivery ? sp.zone : (zones[0]?.pricingKey ?? "accra_central");
  const tested = Number.isFinite(gbp) && gbp > 0 && Number.isFinite(kg) && kg >= 0 && sp.gbp !== undefined;
  const result = tested
    ? priceOrder({
        items: [{ id: "t", unitPriceMinor: Math.round(gbp * 100), quantity: qty, weightGrams: Math.round(kg * 1000), category: cat }],
        pricing: cfg, market: s.market, zoneKey, ignoreMinOrder: true,
      })
    : null;
  const customer = result ? customerOf(result) : null;
  const flags = result ? describeFlags(result.flags) : [];

  return (
    <>
      <PageHead title="Pricing engine">
        <Link href="/admin/pricing" className="link">← Pricing</Link>
      </PageHead>
      <Flash saved={sp.saved} error={sp.error} />
      <p className="hint mb-6 max-w-3xl">
        Every number the shop uses to price an order lives in this configuration: the service charge bands, shipping by weight, insurance, import-duty rates by kind of item,
        delivery by area and the minimum profit. Changes apply to new quotes straight away; orders already placed keep the price they were given.
        The duty rates are planning values: confirm them with your customs agent.
      </p>

      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <div className="grid content-start gap-8">
          <form action={savePricingEngineAction} className="box box-shadow grid gap-4 p-5">
            <h2 className="text-2xl">Configuration</h2>
            <Area
              label="Pricing configuration (JSON)"
              name="config"
              mono
              rows={28}
              defaultValue={JSON.stringify(cfg, null, 2)}
              hint="It is checked before it is saved. If anything is wrong, nothing changes and you are told what to fix."
            />
            <div><button className="btn btn-primary">Save configuration</button></div>
          </form>

          <form action={resetPricingEngineAction} className="box grid gap-3 p-5">
            <h2 className="text-xl">Go back to the shipped configuration</h2>
            <p className="hint">Throws away your changes to the configuration above.</p>
            <Check label="Yes, go back to the shipped configuration" name="confirm" />
            <div><button className="btn">Restore</button></div>
          </form>
        </div>

        <div className="grid h-fit content-start gap-6">
          <form method="get" className="box grid gap-3 p-5">
            <h2 className="text-xl">Try a price</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label="Price in £ (each)" name="gbp" inputMode="decimal" defaultValue={sp.gbp ?? ""} required />
              <Text label="Weight (kg, each)" name="kg" inputMode="decimal" defaultValue={sp.kg ?? ""} required />
              <Text label="How many" name="qty" inputMode="numeric" defaultValue={sp.qty ?? "1"} />
              <Select label="Delivery area" name="zone" defaultValue={zoneKey}>
                {Object.keys(cfg.delivery).map((k) => <option key={k} value={k}>{k}</option>)}
              </Select>
            </div>
            <Select label="Kind of item" name="cat" defaultValue={cat}>
              {cfg.categories.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </Select>
            <div><button className="btn btn-primary">Price it</button></div>
          </form>

          {result && customer && (
            <aside className="receipt grid gap-3 p-5">
              <h2 className="!text-xl">What the customer sees</h2>
              <div className="row"><dt>Items</dt><dd className="num">{ghs(customer.itemsMinor)}</dd></div>
              <div className="row"><dt>Delivery, insurance and import duties</dt><dd className="num">{ghs(customer.deliveryAndImportMinor)}</dd></div>
              <div className="row font-bold"><dt>Total</dt><dd className="num">{ghs(customer.totalMinor)}</dd></div>
              <hr />
              <h3 className="font-sans text-sm font-bold uppercase tracking-wide">Behind it (staff only)</h3>
              <div className="row"><dt>Item at the rate</dt><dd className="num">{ghs(result.itemsGhsMinor)}</dd></div>
              <div className="row"><dt>Service charge</dt><dd className="num">{ghs(result.serviceFeeMinor)}</dd></div>
              <div className="row"><dt>Shipping ({(result.chargeableGrams / 1000).toFixed(1)} kg)</dt><dd className="num">{ghs(result.shippingMinor)}</dd></div>
              <div className="row"><dt>Insurance</dt><dd className="num">{ghs(result.insuranceMinor)}</dd></div>
              <div className="row"><dt>Import duties and taxes</dt><dd className="num">{ghs(result.dutyMinor)}</dd></div>
              <div className="row"><dt>Delivery</dt><dd className="num">{ghs(result.deliveryMinor)}</dd></div>
              <div className="row font-bold">
                <dt>Our contribution</dt>
                <dd className="num">{ghs(Math.round(result.internal.contributionGhs * 100))} ({result.internal.contributionPctOfTotal.toFixed(1)}%)</dd>
              </div>
              {flags.length > 0 && (
                <ul className="list-disc pl-5 font-sans text-sm">
                  {flags.map((f) => <li key={f.kind + f.detail}>{f.label}</li>)}
                </ul>
              )}
            </aside>
          )}
        </div>
      </div>
    </>
  );
}
