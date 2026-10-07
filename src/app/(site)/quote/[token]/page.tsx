import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { placeLinkOrderAction } from "@/app/actions/checkout";
import CheckoutForm from "@/components/CheckoutForm";
import { requireCustomer } from "@/lib/customer-session";
import { listAddresses } from "@/lib/customers";
import { getLinkRequestByToken, hostOf, quotedLine, quoteState } from "@/lib/link-orders";
import { gbp } from "@/lib/money";
import { getOrderById } from "@/lib/orders";
import { gbpToGhsMinor } from "@/lib/pricing";
import { getSettings, getShippingMethods, getZones } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your quoted item", robots: { index: false, follow: false } };

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl">{title}</h1>
      <div className="mt-3 grid gap-4 text-ink-soft">{children}</div>
    </div>
  );
}

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = getLinkRequestByToken(token);
  if (!r) notFound();
  const state = quoteState(r);

  if (state === "ordered") {
    const order = r.orderId ? getOrderById(r.orderId) : null;
    return (
      <Notice title="This item has been ordered">
        <p>You have already ordered this item{order ? ` (${order.number})` : ""}.</p>
        {order && (
          <Link href={order.status === "AWAITING_PAYMENT" ? `/pay/${order.paymentRef}` : `/account/orders/${order.number}`} className="btn btn-primary w-fit">
            {order.status === "AWAITING_PAYMENT" ? "Pay now" : "Track your order"}
          </Link>
        )}
      </Notice>
    );
  }
  if (state === "rejected") return <Notice title="We could not get this item"><p>Sorry, we are not able to buy this item for you. Contact us if you would like help finding something similar.</p></Notice>;
  if (state === "waiting") return <Notice title="We are still checking this item"><p>We will message you with your price as soon as we have checked it.</p></Notice>;
  if (state === "expired") {
    return (
      <Notice title="This quote has expired">
        <p>UK prices change, so we hold each price for a few days. Contact us and we will check the item again and send you a fresh price.</p>
        <Link href="/account#requests" className="btn w-fit">Back to my requests</Link>
      </Notice>
    );
  }

  const customer = await requireCustomer(`/quote/${token}`);
  const settings = getSettings();
  const methods = getShippingMethods();
  const zones = getZones();
  if (methods.length === 0 || zones.length === 0) return <Notice title="Checkout is unavailable"><p>Delivery options are not set up yet. Please try again soon.</p></Notice>;

  const line = quotedLine(r);
  const addresses = listAddresses(customer.id);
  const preferred = addresses.find((a) => a.isDefault) ?? null;
  const cfg = {
    fx: settings.fx,
    serviceFee: settings.serviceFee,
    methods: methods.map((m) => ({ code: m.code, name: m.name, eta: m.eta, rateCard: m.rateCard })),
    zones: zones.map((z) => ({ id: z.id, name: z.name, areas: z.areas, feeMinor: z.feeMinor, eta: z.eta })),
  };
  const initialZone = preferred?.zoneId && zones.some((z) => z.id === preferred.zoneId) ? preferred.zoneId : (customer.defaultZoneId && zones.some((z) => z.id === customer.defaultZoneId) ? customer.defaultZoneId : zones[0].id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <p className="label">Your quoted item</p>
      <h1 className="text-3xl">Pay for your item</h1>
      <section className="box box-shadow mt-4 grid gap-1 p-5">
        <p className="text-lg font-semibold">{line.product.name} × {r.quantity}</p>
        <p className="text-sm text-ink-soft">
          From {hostOf(r.url)} · <a href={r.url} target="_blank" rel="noopener noreferrer" className="link">View on the UK shop ↗</a>
          {r.details ? ` · ${r.details}` : ""}
        </p>
        <p className="num mt-1">
          <span className="font-bold">{gbp(line.product.priceMinor)}</span> each in the UK · checked by our team
        </p>
        {r.quoteNote && <p className="mt-1 rounded-lg bg-paper-2 p-3 text-sm">Note from us: {r.quoteNote}</p>}
        {r.quoteExpiresAt && <p className="text-xs text-ink-soft">This price is held until {r.quoteExpiresAt.slice(0, 16)} UTC.</p>}
      </section>
      <CheckoutForm
        items={[{ id: String(line.itemId), unitPriceMinor: line.product.priceMinor, quantity: line.quantity, weightGrams: line.product.weightGrams }]}
        summary={[{ itemId: String(line.itemId), name: line.product.name, shop: line.product.shopName, options: r.details, quantity: line.quantity, lineGhsMinor: gbpToGhsMinor(line.product.priceMinor * line.quantity, settings.fx) }]}
        cfg={cfg}
        initialZone={initialZone}
        initialShip={methods[0].code}
        profile={{ name: customer.name, phone: customer.phone, email: customer.email ?? "", notifySms: customer.notifySms, notifyEmail: customer.notifyEmail, notifyWhatsapp: customer.notifyWhatsapp }}
        addresses={addresses.map((a) => ({ id: a.id, label: a.label, recipient: a.recipient, phone: a.phone, zoneId: a.zoneId, address: a.address, landmark: a.landmark, isDefault: a.isDefault }))}
        selectedAddressId={preferred?.id ?? null}
        submitAction={placeLinkOrderAction}
        hidden={{ token }}
      />
    </div>
  );
}
