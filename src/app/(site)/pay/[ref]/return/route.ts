import { NextResponse } from "next/server";
import { kickOutbox } from "@/lib/notify/kick";
import { getOrderByRef } from "@/lib/orders";
import { activeGateway } from "@/lib/payments";
import { confirmPaid, failAttempt, pendingAttempts } from "@/lib/payments/confirm";
import { createLimiter } from "@/lib/throttle";

export const dynamic = "force-dynamic";

const limiter = createLimiter(20, 10 * 60 * 1000);

/**
 * Where a gateway sends the customer back. Nothing in the query string is trusted: we ask the
 * gateway directly about each pending attempt, so the order is paid even if the webhook is late.
 */
export async function GET(req: Request, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  const target = new URL(`/order/${encodeURIComponent(ref)}`, req.url);
  const order = getOrderByRef(ref);
  if (!order || !limiter.allowed(ref)) return NextResponse.redirect(target);
  limiter.record(ref);

  for (const attempt of pendingAttempts(order.id)) {
    const gateway = activeGateway(attempt.provider);
    if (!gateway) continue;
    try {
      const check = await gateway.check(attempt.providerRef);
      if (check.status === "paid") confirmPaid(attempt.provider, attempt.providerRef, check.amountMinor, check.currency);
      else if (check.status === "failed") failAttempt(attempt.provider, attempt.providerRef, "Reported failed by the gateway");
    } catch (e) {
      console.error(`[return:${attempt.provider}] check failed`, e instanceof Error ? e.message : "unknown error");
    }
  }
  kickOutbox();
  return NextResponse.redirect(target);
}
