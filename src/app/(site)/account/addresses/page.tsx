import type { Metadata } from "next";
import { defaultAddressAction, deleteAddressAction } from "@/app/actions/account";
import { AddressForm } from "@/components/account/AccountForms";
import { requireCustomer } from "@/lib/customer-session";
import { listAddresses } from "@/lib/customers";
import { getZones } from "@/lib/settings";

export const metadata: Metadata = { title: "Your addresses" };

export default async function AddressesPage() {
  const c = await requireCustomer("/account/addresses");
  const addresses = listAddresses(c.id);
  const zones = getZones().map((z) => ({ id: z.id, name: z.name }));
  const zoneName = new Map(zones.map((z) => [z.id, z.name]));

  return (
    <>
      <p className="label">Your account</p>
      <h1 className="text-5xl">Delivery addresses</h1>
      <p className="mt-2 max-w-xl text-ink-soft">Save the places you get orders delivered and pick one at checkout.</p>

      <ul className="mt-6 grid gap-4 lg:grid-cols-2">
        {addresses.map((a) => (
          <li key={a.id} className="box box-shadow grid content-start gap-2 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="display text-xl">{a.label}</p>
              {a.isDefault && <span className="tag tag-green">Default</span>}
            </div>
            <p>{a.recipient} · {a.phone}</p>
            <p className="whitespace-pre-line text-ink-soft">{a.address}{a.landmark ? `\n${a.landmark}` : ""}</p>
            <p className="label">{a.zoneId ? zoneName.get(a.zoneId) ?? "Area removed" : "No area chosen"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {!a.isDefault && (
                <form action={defaultAddressAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="btn btn-small">Make default</button>
                </form>
              )}
              <form action={deleteAddressAction}>
                <input type="hidden" name="id" value={a.id} />
                <button className="link text-sm text-red">Delete</button>
              </form>
            </div>
            <details className="mt-2 border-t-2 border-dashed border-ink/30 pt-3">
              <summary className="cursor-pointer font-semibold">Edit</summary>
              <div className="mt-3"><AddressForm address={a} zones={zones} /></div>
            </details>
          </li>
        ))}
      </ul>

      <section className="box box-shadow mt-8 max-w-2xl p-6">
        <h2 className="text-2xl">Add an address</h2>
        <div className="mt-4"><AddressForm zones={zones} onlyOne={addresses.length === 0} /></div>
      </section>
    </>
  );
}
