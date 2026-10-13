import Link from "next/link";
import { PageHead } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth";
import { ghs } from "@/lib/money";
import { shippingPrice } from "@/lib/quote-engine";
import { getSettings } from "@/lib/settings";

export default async function ShippingPage() {
  await requirePermission("pricing.manage");
  const { shipping } = getSettings().pricing;
  const weights = [0.5, 1, 2, 3, 5, 10, 15];
  return (
    <>
      <PageHead title="Shipping to Ghana" />
      <p className="mb-6 max-w-2xl text-ink-soft">
        Shipping rates now live in the <Link href="/admin/pricing-engine" className="link font-semibold">pricing engine</Link>, with insurance, import duties and delivery, so they are all set in one place and checked together. This page shows what is in force.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="box box-shadow p-5">
          <h2 className="text-xl">Air freight</h2>
          <p className="mt-1 text-sm text-ink-soft">{shipping.airTransit}</p>
          <table className="table mt-3">
            <thead><tr><th>Parcel weight</th><th className="text-right">Shipping price</th></tr></thead>
            <tbody>
              {weights.map((kg) => <tr key={kg}><td>up to {kg} kg</td><td className="num text-right">{ghs(Math.round(shippingPrice(kg, getSettings().pricing) * 100))}</td></tr>)}
            </tbody>
          </table>
          <p className="hint mt-2">Weight is counted in steps of {shipping.stepKg} kg. Above 10 kg it is {ghs(Math.round(shipping.perKgAbove10Ghs * 100))} per kg. The most one item may weigh is {shipping.maxKgPerParcel} kg.</p>
        </section>
        <section className="box box-shadow p-5">
          <h2 className="text-xl">Economy sea freight {shipping.sea.enabled ? <span className="tag tag-green ml-2">On</span> : <span className="tag ml-2">Off</span>}</h2>
          <p className="mt-1 text-sm text-ink-soft">{shipping.sea.transit}. For orders of {shipping.sea.minBillableKg} kg or more, at {ghs(Math.round(shipping.sea.ratePerKgGhs * 100))} per kg (at least {ghs(Math.round(shipping.sea.minGhs * 100))}).</p>
          <p className="hint mt-3">
            {shipping.sea.enabled ? "Customers can choose it at checkout when their order is heavy enough." : "Customers cannot choose it. Turn it on in the pricing engine (shipping, sea, enabled) only once you have a partner's sailing schedule and a written quote."}
          </p>
        </section>
      </div>
    </>
  );
}
