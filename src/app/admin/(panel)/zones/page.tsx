import { requirePermission } from "@/lib/auth";
import { deleteZoneAction, saveZoneAction } from "@/app/admin/actions";
import { Check, Flash, PageHead, Text } from "@/components/admin/ui";
import { ghs } from "@/lib/money";
import { getSettings, getZones } from "@/lib/settings";
import { deliveryFee } from "@/lib/quote-engine";

function ZoneForm({ z, keys }: { z?: ReturnType<typeof getZones>[number]; keys: string[] }) {
  const k = `zone-${z?.id ?? "new"}`;
  return (
    <form action={saveZoneAction} className="grid gap-4">
      <input type="hidden" name="id" value={z?.id ?? 0} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Area name" name="name" id={`${k}-name`} defaultValue={z?.name} required />
        <div className="field">
          <label className="label" htmlFor={`${k}-key`}>Delivery price</label>
          <select id={`${k}-key`} name="pricingKey" className="select" defaultValue={z?.pricingKey ?? "other_regions"}>
            {keys.map((key) => <option key={key} value={key}>{key.replace(/_/g, " ")}</option>)}
          </select>
          <p className="hint">Which delivery price in the pricing engine applies here.</p>
        </div>
      </div>
      <Text label="Places included" name="areas" id={`${k}-areas`} defaultValue={z?.areas} placeholder="Osu, Ridge, Cantonments" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Usual delivery time" name="eta" id={`${k}-eta`} defaultValue={z?.eta} placeholder="1 to 2 days" />
        <Text label="Order on the page" name="sort" id={`${k}-sort`} inputMode="numeric" defaultValue={z ? 0 : 9} hint="Lower shows first." />
      </div>
      <Check label="Deliver to this area" name="active" defaultChecked={z?.active ?? true} />
      <div><button className="btn btn-primary">{z ? "Save area" : "Add area"}</button></div>
    </form>
  );
}

export default async function ZonesPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requirePermission("pricing.manage");
  const sp = await searchParams;
  const zones = getZones(false);
  const pricing = getSettings().pricing;
  const keys = Object.keys(pricing.delivery);
  return (
    <>
      <PageHead title="Delivery areas" />
      <p className="mb-6 max-w-2xl text-ink-soft">These are the areas customers choose from at checkout. The delivery price for each comes from the pricing engine, and is part of the one delivery line customers see. Change a fee, rename an area, add one with &ldquo;+ Add a delivery area&rdquo;, or delete one. Changes show at checkout straight away.</p>
      <Flash saved={sp.saved} error={sp.error} />
      <div className="grid gap-6">
        {zones.map((z) => (
          <details key={z.id} className="box box-shadow">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-4 text-xl font-bold">
              <span>{z.name} {!z.active && <span className="tag ml-2">Hidden</span>}</span>
              <span className="num mono text-base font-medium">{z.pricingKey.replace(/_/g, " ")} · from {ghs(Math.round(deliveryFee(z.pricingKey, 2, pricing) * 100))}</span>
            </summary>
            <div className="grid gap-6 border-t border-line p-5">
              <ZoneForm z={z} keys={keys} />
              <form action={deleteZoneAction} className="grid gap-3 border-t border-line pt-5">
                <input type="hidden" name="id" value={z.id} />
                <h3 className="text-lg font-bold">Delete this area</h3>
                <p className="text-sm text-ink-soft">
                  Customers can no longer choose <strong>{z.name}</strong>. Orders already placed keep the area and price they were charged. To keep it for later, untick
                  &ldquo;Deliver to this area&rdquo; above instead.
                </p>
                <Check label={`Yes, delete ${z.name}`} name="confirm" />
                <div><button className="btn btn-danger">Delete area</button></div>
              </form>
            </div>
          </details>
        ))}
        <details className="box box-shadow">
          <summary className="cursor-pointer p-4 text-xl font-bold">+ Add a delivery area</summary>
          <div className="border-t border-line p-5"><ZoneForm keys={keys} /></div>
        </details>
      </div>
    </>
  );
}
