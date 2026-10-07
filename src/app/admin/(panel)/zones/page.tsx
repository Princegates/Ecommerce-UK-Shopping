import { requireAdmin } from "@/lib/auth";
import { saveZoneAction } from "@/app/admin/actions";
import { Check, Flash, PageHead, Text } from "@/components/admin/ui";
import { minorToInput } from "@/lib/money";
import { getZones } from "@/lib/settings";

function ZoneForm({ z }: { z?: ReturnType<typeof getZones>[number] }) {
  return (
    <form action={saveZoneAction} className="grid gap-4">
      <input type="hidden" name="id" value={z?.id ?? 0} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Area name" name="name" defaultValue={z?.name} required />
        <Text label="Delivery fee (GH₵)" name="fee" inputMode="decimal" defaultValue={minorToInput(z?.feeMinor ?? 5000)} />
      </div>
      <Text label="Places included" name="areas" defaultValue={z?.areas} placeholder="Osu, Ridge, Cantonments" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Usual delivery time" name="eta" defaultValue={z?.eta} placeholder="1 to 2 days" />
        <Text label="Order on the page" name="sort" inputMode="numeric" defaultValue={z ? 0 : 9} hint="Lower shows first." />
      </div>
      <Check label="Deliver to this area" name="active" defaultChecked={z?.active ?? true} />
      <div><button className="btn btn-primary">{z ? "Save area" : "Add area"}</button></div>
    </form>
  );
}

export default async function ZonesPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const zones = getZones(false);
  return (
    <>
      <PageHead title="Delivery areas" />
      <p className="mb-6 max-w-2xl text-ink-soft">The delivery fee is added to the customer&rsquo;s total for orders to that area.</p>
      <Flash saved={sp.saved} error={sp.error} />
      <div className="grid gap-6">
        {zones.map((z) => (
          <details key={z.id} className="box box-shadow">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-4 text-xl font-bold">
              <span>{z.name} {!z.active && <span className="tag ml-2">Hidden</span>}</span>
              <span className="num mono text-base font-medium">GH₵{minorToInput(z.feeMinor)}</span>
            </summary>
            <div className="border-t border-line p-5"><ZoneForm z={z} /></div>
          </details>
        ))}
        <details className="box box-shadow">
          <summary className="cursor-pointer p-4 text-xl font-bold">+ Add a delivery area</summary>
          <div className="border-t border-line p-5"><ZoneForm /></div>
        </details>
      </div>
    </>
  );
}
