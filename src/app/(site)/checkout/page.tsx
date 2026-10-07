import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import CheckoutForm from "@/components/CheckoutForm";
import { getCart } from "@/lib/cart";
import { requireCustomer } from "@/lib/customer-session";
import { listAddresses } from "@/lib/customers";
import { gbpToGhsMinor } from "@/lib/pricing";
import { getSettings, getShippingMethods, getZones } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ zone?: string; ship?: string }> }) {
  const lines = await getCart();
  if (lines.length === 0) redirect("/cart");

  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.zone) qs.set("zone", sp.zone);
  if (sp.ship) qs.set("ship", sp.ship);
  const customer = await requireCustomer(`/checkout${qs.size ? `?${qs}` : ""}`);

  const settings = getSettings();
  const methods = getShippingMethods();
  const zones = getZones();
  if (methods.length === 0 || zones.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <h1 className="text-4xl">Checkout is unavailable</h1>
        <p className="mt-3">Delivery options are not set up yet. Please try again soon.</p>
      </div>
    );
  }

  const addresses = listAddresses(customer.id);
  const preferred = addresses.find((a) => a.isDefault) ?? null;
  const cfg = {
    fx: settings.fx,
    serviceFee: settings.serviceFee,
    methods: methods.map((m) => ({ code: m.code, name: m.name, eta: m.eta, rateCard: m.rateCard })),
    zones: zones.map((z) => ({ id: z.id, name: z.name, areas: z.areas, feeMinor: z.feeMinor, eta: z.eta })),
  };
  const fromQuery = zones.find((z) => String(z.id) === sp.zone)?.id;
  const initialZone = fromQuery ?? (preferred?.zoneId && zones.some((z) => z.id === preferred.zoneId) ? preferred.zoneId : null) ?? customer.defaultZoneId ?? zones[0].id;
  const initialShip = methods.find((m) => m.code === sp.ship)?.code ?? methods[0].code;

  const items = lines.map((l) => ({
    id: String(l.itemId),
    unitPriceMinor: l.product.priceMinor,
    quantity: l.quantity,
    weightGrams: l.product.weightGrams,
  }));
  const summary = lines.map((l) => ({
    itemId: String(l.itemId),
    name: l.product.name,
    shop: l.product.shopName,
    options: Object.values(l.options).join(" / "),
    quantity: l.quantity,
    lineGhsMinor: gbpToGhsMinor(l.product.priceMinor * l.quantity, settings.fx),
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <p className="label">Step 2 of 3</p>
      <h1 className="text-5xl">Checkout</h1>
      <p className="mt-2 text-ink-soft">
        <Link href="/cart" className="link">← Back to cart</Link>
      </p>
      <CheckoutForm
        items={items}
        summary={summary}
        cfg={cfg}
        initialZone={zones.some((z) => z.id === initialZone) ? initialZone : zones[0].id}
        initialShip={initialShip}
        profile={{
          name: customer.name, phone: customer.phone, email: customer.email ?? "",
          notifySms: customer.notifySms, notifyEmail: customer.notifyEmail, notifyWhatsapp: customer.notifyWhatsapp,
        }}
        addresses={addresses.map((a) => ({ id: a.id, label: a.label, recipient: a.recipient, phone: a.phone, zoneId: a.zoneId, address: a.address, landmark: a.landmark, isDefault: a.isDefault }))}
        selectedAddressId={preferred?.id ?? null}
      />
    </div>
  );
}
