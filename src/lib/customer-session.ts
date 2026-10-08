import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, customerForSession, deleteSession, SESSION_DAYS, type Customer } from "./customers";

const secure = () => process.env.NODE_ENV === "production";
// The __Host- prefix makes browsers refuse the cookie unless it is Secure, path=/ and has no Domain.
const cookieName = () => (secure() ? "__Host-sid" : "sid");

/** The signed-in customer for this request, or null. Looked up once per request. */
export const getCustomer = cache(async (): Promise<Customer | null> => {
  const jar = await cookies();
  return customerForSession(jar.get(cookieName())?.value);
});

export async function currentSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(cookieName())?.value ?? null;
}

/** Use at the top of every account page and action. Sends visitors to sign in, then back. */
export async function requireCustomer(next = "/account"): Promise<Customer> {
  const c = await getCustomer();
  if (!c) redirect(`/login?next=${encodeURIComponent(safeNext(next))}`);
  return c;
}

export async function startCustomerSession(customerId: number): Promise<void> {
  const ua = (await headers()).get("user-agent") ?? "";
  const raw = createSession(customerId, ua);
  const jar = await cookies();
  jar.set(cookieName(), raw, { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: SESSION_DAYS * 24 * 60 * 60 });
}

export async function endCustomerSession(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(cookieName())?.value;
  if (raw) deleteSession(raw);
  // set again with the same attributes and an immediate expiry: browsers ignore the removal of a Secure __Host- cookie that lacks them
  jar.set(cookieName(), "", { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: 0 });
}

/** Only same-site relative paths, so a login link can never send someone to another website. */
export function safeNext(next: string | null | undefined, fallback = "/account"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\r\n]/.test(next)) return fallback;
  if (next.startsWith("/login") || next.startsWith("/register")) return fallback;
  return next.slice(0, 300);
}
