import { NextResponse } from "next/server";
import { kickOutbox } from "@/lib/notify/kick";
import { applyOutcome } from "@/lib/payments/confirm";
import { activeGateway } from "@/lib/payments";

export const dynamic = "force-dynamic";

const MAX_BODY = 1_000_000;

/**
 * Gateway webhooks. The signature is checked on the raw body before anything is read from it,
 * the gateway is asked to confirm where its webhook is only authenticated by a shared hash, and
 * the order is marked paid only if the amount and currency match. Events are applied once.
 */
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const gateway = activeGateway(provider);
  if (!gateway) return NextResponse.json({ error: "not found" }, { status: 404 });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "too large" }, { status: 413 });

  let outcome;
  try {
    outcome = await gateway.parseWebhook(raw, req.headers);
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!outcome) return NextResponse.json({ error: "invalid signature" }, { status: 400 });

  try {
    if (outcome.kind === "paid" && gateway.verifyOnWebhook) {
      const check = await gateway.check(outcome.providerRef);
      if (check.status !== "paid") return NextResponse.json({ received: true, verified: false });
      outcome = { ...outcome, amountMinor: check.amountMinor, currency: check.currency };
    }
    const result = applyOutcome(gateway.id, outcome);
    kickOutbox();
    return NextResponse.json({ received: true, result });
  } catch (e) {
    console.error(`[webhook:${provider}] processing failed`, e instanceof Error ? e.message : "unknown error");
    // 500 so the gateway retries
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
