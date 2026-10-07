import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { confirmDemoPaymentAction, startPaymentAction } from "@/app/actions/checkout";
import { gbp, ghs } from "@/lib/money";
import { getOrderByRef } from "@/lib/orders";
import { activeGateways, demoPaymentsEnabled } from "@/lib/payments";
import { pendingAttempts } from "@/lib/payments/confirm";
import { ghsToGbpMinor } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment", robots: { index: false } };

const BLURB: Record<string, string> = {
  paystack: "Mobile Money (MTN, Telecel, AirtelTigo) and Ghana cards. Pay in cedis.",
  flutterwave: "Mobile Money, cards and bank payment. Pay in cedis.",
  stripe: "Visa, Mastercard and other international cards.",
};

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { ref } = await params;
  const sp = await searchParams;
  const order = getOrderByRef(ref);
  if (!order) notFound();
  if (order.paymentStatus === "PAID") redirect(`/order/${ref}`);

  const gateways = activeGateways();
  const demo = demoPaymentsEnabled();
  const waiting = pendingAttempts(order.id);
  const fx = { rate: order.fxRate, markupPct: order.fxMarkupPct };

  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <p className="label">Step 3 of 3</p>
      <h1 className="text-3xl">
        Pay for order <span className="mono whitespace-nowrap text-[0.7em]">{order.number}</span>
      </h1>

      <div className="receipt mt-8 p-5">
        <div className="row total">
          <dt>Amount due</dt>
          <dd className="num">{ghs(order.totalMinor)}</dd>
        </div>
      </div>

      {sp.error && <p role="alert" className="box mt-6 border-red bg-red/10 p-3 font-semibold text-red">{sp.error}</p>}
      {order.paymentStatus === "FAILED" && !sp.error && <p className="error-text mt-6">The last payment attempt failed. You can try again.</p>}
      {waiting.length > 0 && (
        <p className="box mt-6 bg-gold/30 p-3 text-sm">
          A payment is waiting for confirmation. If you have already paid, <a className="link font-semibold" href={`/pay/${ref}/return`}>check its status</a>.
        </p>
      )}

      {gateways.length > 0 && (
        <section className="mt-8" aria-labelledby="methods">
          <h2 id="methods" className="text-2xl">Choose how to pay</h2>
          <ul className="mt-4 grid gap-4">
            {gateways.map((g) => {
              const amount = g.chargeCurrency === "GHS" ? ghs(order.totalMinor) : gbp(ghsToGbpMinor(order.totalMinor, fx));
              return (
                <li key={g.id}>
                  <form action={startPaymentAction} className="box box-shadow flex flex-wrap items-center justify-between gap-4 p-4">
                    <input type="hidden" name="ref" value={ref} />
                    <input type="hidden" name="provider" value={g.id} />
                    <div>
                      <p className="display text-xl">{g.label}</p>
                      <p className="text-sm text-ink-soft">{BLURB[g.id]}</p>
                      {g.chargeCurrency === "GBP" && (
                        <p className="hint mt-1">You will be charged {amount}, the pound equivalent of {ghs(order.totalMinor)} at today&rsquo;s rate on your order.</p>
                      )}
                    </div>
                    <button className="btn btn-primary">Pay {amount}</button>
                  </form>
                </li>
              );
            })}
          </ul>
          <p className="hint mt-3">You will be taken to the payment provider&rsquo;s secure page. We never see your card or Mobile Money PIN.</p>
        </section>
      )}

      {demo && (
        <div className="box box-shadow mt-8 grid gap-4 bg-gold/30 p-5">
          <p className="tag tag-red w-fit">Demo payment</p>
          <p>This stand-in moves no money. Choosing a button below only changes the order&rsquo;s status.</p>
          <form action={confirmDemoPaymentAction} className="grid gap-3">
            <input type="hidden" name="ref" value={ref} />
            <button name="outcome" value="success" className="btn btn-primary">Simulate successful payment</button>
            <button name="outcome" value="fail" className="btn">Simulate failed payment</button>
          </form>
        </div>
      )}

      {gateways.length === 0 && !demo && (
        <p className="box mt-8 p-5">Online payment is not available yet. Please contact us to complete this order.</p>
      )}
    </div>
  );
}
