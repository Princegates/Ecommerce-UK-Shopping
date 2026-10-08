import { NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { clientKey } from "@/lib/auth";
import { getCustomer, safeNext } from "@/lib/customer-session";
import { beginAuth, STATE_MINUTES } from "@/lib/social/flow";
import { authorizeUrl, isSocialProvider, redirectUri, socialConfig } from "@/lib/social/providers";
import { bindCookieName, bindCookieOptions } from "@/lib/social/cookies";
import { createLimiter } from "@/lib/throttle";

export const dynamic = "force-dynamic";

const limiter = createLimiter(30, 10 * 60 * 1000);

/** Sends the visitor to Google, Facebook or Apple. With ?link=1 a signed-in customer connects that method to their account instead. */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const base = appUrl();
  const go = (path: string) => NextResponse.redirect(new URL(path, base ?? req.url), 303);
  if (!base || !isSocialProvider(provider)) return go("/login?social_error=unavailable");

  const key = `ip:${await clientKey()}`;
  if (!limiter.allowed(key)) return go("/login?social_error=failed");
  limiter.record(key);

  const url = new URL(req.url);
  const linking = url.searchParams.get("link") === "1";
  const customer = linking ? await getCustomer() : null;
  if (linking && !customer) return go("/login?next=%2Faccount%2Fsecurity");
  const next = safeNext(url.searchParams.get("next"), linking ? "/account/security" : "/account");
  const back = linking ? "/account/security" : "/login";

  const cfg = socialConfig(provider);
  const redirect = redirectUri(provider);
  if (!cfg || !redirect) return go(`${back}?social_error=unavailable`);

  const b = beginAuth(provider, { next, linkCustomerId: customer?.id ?? null });
  const res = NextResponse.redirect(authorizeUrl(provider, cfg, { state: b.state, nonce: b.nonce, challenge: b.challenge, redirectUri: redirect }), 303);
  res.cookies.set(bindCookieName(), b.binding, bindCookieOptions(STATE_MINUTES * 60));
  return res;
}
