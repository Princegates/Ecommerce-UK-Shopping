import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import OrderDetailView from "@/components/OrderDetailView";
import { requireCustomer } from "@/lib/customer-session";
import { getOrderEvents, getOrderForCustomer, getOrderItems, getTracking } from "@/lib/orders";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Track your order" };

export default async function AccountOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const c = await requireCustomer(`/account/orders/${number}`);
  const order = getOrderForCustomer(c.id, decodeURIComponent(number));
  if (!order) notFound();
  return (
    <>
      <p className="mb-4 text-sm"><Link href="/account/orders" className="link">← All orders</Link></p>
      <OrderDetailView
        order={order}
        items={getOrderItems(order.id)}
        events={getOrderEvents(order.id)}
        tracking={getTracking(order.id)}
        whatsapp={getSettings().supportWhatsapp}
        account
      />
    </>
  );
}
