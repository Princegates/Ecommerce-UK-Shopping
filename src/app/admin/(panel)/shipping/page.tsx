import { requirePermission } from "@/lib/auth";
import { saveMethodAction } from "@/app/admin/actions";
import { Area, Check, Flash, PageHead, Text } from "@/components/admin/ui";
import { bracketsToText } from "@/lib/admin-parse";
import { minorToInput } from "@/lib/money";
import { getShippingMethods } from "@/lib/settings";

function MethodForm({ m }: { m?: ReturnType<typeof getShippingMethods>[number] }) {
  return (
    <form action={saveMethodAction} className="grid gap-4">
      <input type="hidden" name="id" value={m?.id ?? 0} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Name" name="name" defaultValue={m?.name} required />
        <Text label="Delivery time shown to customers" name="eta" defaultValue={m?.eta} placeholder="8 to 12 days from UK dispatch" />
      </div>
      <Area
        label="Weight brackets: “grams, price (GH₵)” on each line"
        name="brackets"
        mono
        rows={5}
        defaultValue={m ? bracketsToText(m.rateCard.brackets) : "500, 60.00\n1000, 90.00\n2000, 150.00"}
        hint="A parcel up to 500 g costs the first price, up to 1000 g the second, and so on."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Text label="Per extra kg above the last bracket (GH₵)" name="extraPerKg" inputMode="decimal" defaultValue={minorToInput(m?.rateCard.extraPerKgMinor ?? 6000)} />
        <Text label="Minimum charge (GH₵)" name="minCharge" inputMode="decimal" defaultValue={minorToInput(m?.rateCard.minChargeMinor ?? 7000)} />
        <Text label="Order on the page" name="sort" inputMode="numeric" defaultValue={m ? 0 : 5} hint="Lower shows first." />
      </div>
      <Check label="Offer this method to customers" name="active" defaultChecked={m?.active ?? true} />
      <div><button className="btn btn-primary">{m ? "Save method" : "Add method"}</button></div>
    </form>
  );
}

export default async function ShippingPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requirePermission("pricing.manage");
  const sp = await searchParams;
  const methods = getShippingMethods(false);
  return (
    <>
      <PageHead title="Shipping to Ghana" />
      <p className="mb-6 max-w-2xl text-ink-soft">
        Shipping is charged by the parcel&rsquo;s total weight in grams. Rates are in cedis and apply to the whole order.
      </p>
      <Flash saved={sp.saved} error={sp.error} />
      <div className="grid gap-8">
        {methods.map((m) => (
          <details key={m.id} className="box box-shadow" open={methods.length === 1}>
            <summary className="cursor-pointer p-4 text-xl font-bold">
              {m.name} {!m.active && <span className="tag ml-2">Hidden</span>}
            </summary>
            <div className="border-t border-line p-5"><MethodForm m={m} /></div>
          </details>
        ))}
        <details className="box box-shadow">
          <summary className="cursor-pointer p-4 text-xl font-bold">+ Add a shipping method</summary>
          <div className="border-t border-line p-5"><MethodForm /></div>
        </details>
      </div>
    </>
  );
}
