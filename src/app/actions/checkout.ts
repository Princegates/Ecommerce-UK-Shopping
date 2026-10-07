"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientKey } from "@/lib/auth";
import { clearCart, loadCart, readCartToken } from "@/lib/cart";
import { getCustomer } from "@/lib/customer-session";
import { kickOutbox } from "@/lib/notify/kick";
import { saveAddress } from "@/lib/customers";
import { placeLinkOrder } from "@/lib/link-orders";
import { createOrder, getOrderByRef, markPaid, markPaymentFailed } from "@/lib/orders";
import { randomBytes } from "node:crypto";
import { appHost, appUrl } from "@/lib/app-url";
import { activeGateway, demoPaymentsEnabled } from "@/lib/payments";
import { createAttempt } from "@/lib/payments/confirm";
import { ghsToGbpMinor } from "@/lib/pricing";
import { createLimiter } from "@/lib/throttle";
import { checkoutSchema, firstError } from "@/lib/validation";

// Orders per client per hour: generous for real shoppers, a brake on scripts filling the order book.
const orderLimiter = createLimiter(10, 60 * 60 * 1000);

export type CheckoutState = { error?: string; values?: Record<string, string> };

export async function placeOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const customer = await getCustomer();
  if (!customer) redirect("/login?next=" + encodeURIComponent("/checkout"));
  const values: Record<string, string> = {};
  for (const k of ["customerName", "phone", "email", "address", "landmark", "notes", "zone", "ship"]) {
    values[k] = String(formData.get(k) ?? "");
  }
  const parsed = checkoutSchema.safeParse({
    customerName: values.customerName,
    phone: values.phone,
    email: values.email,
    zoneId: values.zone,
    address: values.address,
    landmark: values.landmark,
    notes: values.notes,
    shippingCode: values.ship,
  });
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const key = `order:${await clientKey()}`;
  if (!orderLimiter.allowed(key)) return { error: "You have placed several orders recently. Please try again later or contact us.", values };

  const token = await readCartToken();
  const lines = loadCart(token);
  const res = createOrder(lines, {
    ...parsed.data,
    customerId: customer.id,
    notifySms: formData.get("notifySms") === "on",
    notifyEmail: formData.get("notifyEmail") === "on",
    notifyWhatsapp: formData.get("notifyWhatsapp") === "on",
  });
  if (!res.ok) return { error: res.error, values };
  orderLimiter.record(key);
  if (formData.get("saveAddress") === "on") {
    // Best effort: a full address book or a bad field must not stop the order.
    saveAddress(customer.id, {
      label: String(formData.get("addressLabel") ?? "") || "Home",
      recipient: parsed.data.customerName,
      phone: parsed.data.phone,
      zoneId: parsed.data.zoneId,
      address: parsed.data.address,
      landmark: parsed.data.landmark,
      makeDefault: false,
    });
  }

  if (token) clearCart(token);
  revalidatePath("/", "layout");
  redirect(`/pay/${res.paymentRef}`);
}

/** Pays for a link request the team has quoted: the same details as checkout, but the item comes from the quote. */
export async function placeLinkOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const token = String(formData.get("token") ?? "");
  const customer = await getCustomer();
  if (!customer) redirect("/login?next=" + encodeURIComponent(`/quote/${token}`));
  const values: Record<string, string> = {};
  for (const k of ["customerName", "phone", "email", "address", "landmark", "notes", "zone", "ship"]) values[k] = String(formData.get(k) ?? "");
  const parsed = checkoutSchema.safeParse({
    customerName: values.customerName, phone: values.phone, email: values.email, zoneId: values.zone, address: values.address,
    landmark: values.landmark, notes: values.notes, shippingCode: values.ship,
  });
  if (!parsed.success) return { error: firstError(parsed.error), values };
  const key = `order:${await clientKey()}`;
  if (!orderLimiter.allowed(key)) return { error: "You have placed several orders recently. Please try again later or contact us.", values };
  const res = placeLinkOrder(token, {
    ...parsed.data, customerId: customer.id,
    notifySms: formData.get("notifySms") === "on", notifyEmail: formData.get("notifyEmail") === "on", notifyWhatsapp: formData.get("notifyWhatsapp") === "on",
  });
  if (!res.ok) return { error: res.error, values };
  if (!res.existing) orderLimiter.record(key);
  revalidatePath("/", "layout");
  redirect(`/pay/${res.paymentRef}`);
}

/** DEMO ONLY: confirms the payment without moving money. Disabled in production unless explicitly enabled. */
export async function confirmDemoPaymentAction(formData: FormData): Promise<void> {
  const ref = String(formData.get("ref") ?? "");
  const outcome = String(formData.get("outcome") ?? "success");
  if (!demoPaymentsEnabled() || !getOrderByRef(ref)) redirect("/");
  if (outcome === "fail") markPaymentFailed(ref);
  else markPaid(ref);
  kickOutbox();
  redirect(`/order/${ref}`);
}

/** Start a payment with one of the enabled gateways and send the customer to its hosted page. */
export async function startPaymentAction(formData: FormData): Promise<void> {
  const ref = String(formData.get("ref") ?? "");
  const providerId = String(formData.get("provider") ?? "");
  const back = (msg: string): never => redirect(`/pay/${encodeURIComponent(ref)}?error=${encodeURIComponent(msg)}`);

  const order = getOrderByRef(ref);
  if (!order) redirect("/");
  if (order.status !== "AWAITING_PAYMENT" || order.paymentStatus === "PAID") redirect(`/order/${ref}`);

  const gateway = activeGateway(providerId);
  if (!gateway) return back("That payment method is not available right now.");
  const base = appUrl();
  if (!base) return back("Online payment is not set up yet. Please contact us.");

  const currency = gateway.chargeCurrency;
  const amountMinor =
    currency === "GHS" ? order.totalMinor : ghsToGbpMinor(order.totalMinor, { rate: order.fxRate, markupPct: order.fxMarkupPct });
  if (amountMinor <= 0) return back("This order has nothing to pay.");

  const attemptRef = `att_${randomBytes(10).toString("hex")}`;
  let redirectUrl: string;
  try {
    const out = await gateway.createCheckout({
      attemptRef,
      orderNumber: order.number,
      customerName: order.customerName,
      phone: order.phone,
      email: order.email || `customer-${order.number.toLowerCase()}@${appHost()}`,
      amountMinor,
      currency,
      returnUrl: `${base}/pay/${ref}/return`,
      cancelUrl: `${base}/pay/${ref}`,
    });
    createAttempt({ orderId: order.id, provider: gateway.id, providerRef: out.providerRef, attemptRef, currency, amountMinor });
    redirectUrl = out.redirectUrl;
  } catch (e) {
    console.error(`[pay:${gateway.id}] could not start`, e instanceof Error ? e.message : "unknown error");
    return back(`We could not start ${gateway.label}. Please try another method or try again.`);
  }
  redirect(redirectUrl);
}
