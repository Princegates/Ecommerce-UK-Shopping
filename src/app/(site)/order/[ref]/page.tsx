import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import OrderDetailView from "@/components/OrderDetailView";
import { getCustomer } from "@/lib/customer-session";
import { getOrderByRef, getOrderEvents, getOrderItems, getTracking } from "@/lib/orders";
import { pendingAttempts } from "@/lib/payments/confirm";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order", robots: { index: false }, referrer: "no-referrer" };

/**
 * The private link to an order. Owners who are signed in go to the same page inside their account;
 * anyone else with the link (for example straight after paying) sees it here.
 */
export default async function OrderPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const order = getOrderByRef(ref);
  if (!order) notFound();
  const customer = await getCustomer();
  if (customer && order.paymentStatus === "PAID") {
    const mine = (await import("@/lib/orders")).getOrderForCustomer(customer.id, order.number);
    if (mine) redirect(`/account/orders/${order.number}`);
  }
  const waiting = order.status === "AWAITING_PAYMENT" ? pendingAttempts(order.id) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {waiting.length > 0 && (
        <p role="status" className="box mb-6 bg-gold/30 p-3 text-sm">
          We are waiting for your payment provider to confirm your payment. This usually takes under a minute.{" "}
          <Link href={`/pay/${ref}/return`} className="link font-semibold">Check now</Link>
        </p>
      )}
      <OrderDetailView
        order={order}
        items={getOrderItems(order.id)}
        events={getOrderEvents(order.id)}
        tracking={getTracking(order.id)}
        whatsapp={getSettings().supportWhatsapp}
        account={false}
      />
      {!customer && (
        <p className="mt-10 text-sm text-ink-soft">
          <Link href="/login" className="link font-semibold">Sign in</Link> to see all your orders and tracking in one place.
        </p>
      )}
    </div>
  );
}
