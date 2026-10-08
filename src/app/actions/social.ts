"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clientKey } from "@/lib/auth";
import { startCustomerSession } from "@/lib/customer-session";
import { completeSocialSignup } from "@/lib/social/flow";
import { expiredSignupCookie, signupCookieName } from "@/lib/social/cookies";
import { createLimiter } from "@/lib/throttle";
import type { FormState } from "./account";

const byIp = createLimiter(10, 60 * 60 * 1000);
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Last step of a first-time Google, Facebook or Apple sign-in: we need a phone number to reach the customer about deliveries. */
export async function completeSocialSignupAction(_prev: FormState, f: FormData): Promise<FormState> {
  const values = { name: str(f, "name"), phone: str(f, "phone") };
  const jar = await cookies();
  const raw = jar.get(signupCookieName())?.value;
  if (!raw) redirect("/login?social_error=expired");
  const ip = `ip:${await clientKey()}`;
  if (!byIp.allowed(ip)) return { error: "Too many attempts from this connection. Please try again later.", values };
  byIp.record(ip);

  const res = await completeSocialSignup(raw, values);
  if (!res.ok) {
    if (res.expired) redirect("/login?social_error=expired");
    return { error: res.error, values };
  }
  jar.set(expiredSignupCookie());
  await startCustomerSession(res.customer.id);
  revalidatePath("/", "layout");
  redirect(res.next);
}
