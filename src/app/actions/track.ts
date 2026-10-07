"use server";

import { redirect } from "next/navigation";
import { clientKey } from "@/lib/auth";
import { findOrderForTracking } from "@/lib/orders";
import { createLimiter } from "@/lib/throttle";
import { firstError, trackSchema } from "@/lib/validation";

export type TrackState = { error?: string; number?: string };

// Failed lookups per client: enough for typos, too few to guess phone numbers.
const failures = createLimiter(8, 15 * 60 * 1000);

export async function trackAction(_prev: TrackState, formData: FormData): Promise<TrackState> {
  const number = String(formData.get("number") ?? "");
  const parsed = trackSchema.safeParse({ number, contact: formData.get("contact") });
  if (!parsed.success) return { error: firstError(parsed.error), number };

  const key = `track:${await clientKey()}`;
  if (!failures.allowed(key)) return { error: "Too many attempts. Please try again in 15 minutes.", number };

  const order = findOrderForTracking(parsed.data.number, parsed.data.contact);
  // One message for "no such order" and "wrong contact" so order numbers cannot be probed.
  if (!order) {
    failures.record(key);
    return { error: "We could not find an order with those details. Check the number and the phone or email you used.", number };
  }
  failures.clear(key);
  redirect(`/order/${order.paymentRef}`);
}
