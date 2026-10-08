import { NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { clientKey } from "@/lib/auth";
import { getCustomer, startCustomerSession } from "@/lib/customer-session";
import { consumeState, resolveSocialLogin, SIGNUP_MINUTES } from "@/lib/social/flow";
import { exchangeCode, isSocialProvider, redirectUri, SocialError, socialConfig, type SocialProviderId } from "@/lib/social/providers";

/** Query-string text is the visitor's to write, so it is cut down to plain words before it goes in a log line. */
const plain = (v: string) => v.replace(/[^\w .,:;()'-]/g, "").slice(0, 120);
import { bindCookieName, expiredBindCookie, signupCookieName, signupCookieOptions, type SocialErrorCode } from "@/lib/social/cookies";
import { createLimiter } from "@/lib/throttle";

export const dynamic = "force-dynamic";

const limiter = createLimiter(30, 10 * 60 * 1000);

type Params = { get(name: string): string | null | FormDataEntryValue };
const field = (p: Params, k: string) => {
  const v = p.get(k);
  return typeof v === "string" ? v : "";
};

async function handle(req: Request, provider: string, params: Params): Promise<NextResponse> {
  const base = appUrl();
  const go = (path: string) => NextResponse.redirect(new URL(path, base ?? req.url), 303);
  if (!base || !isSocialProvider(provider)) return go("/login?social_error=unavailable");
  const id: SocialProviderId = provider;

  // Whatever happens, the one-time cookie that tied this attempt to this browser is spent.
  const finish = (res: NextResponse) => {
    res.cookies.set(expiredBindCookie());
    return res;
  };
  const key = `ip:${await clientKey()}`;
  if (!limiter.allowed(key)) return finish(go("/login?social_error=failed"));
  limiter.record(key);

  const cookie = req.headers.get("cookie") ?? "";
  const binding = cookie.split(/;\s*/).find((c) => c.startsWith(`${bindCookieName()}=`))?.slice(bindCookieName().length + 1) ?? "";
  const consumed = consumeState(id, field(params, "state"), binding);
  const linking = Boolean(consumed?.linkCustomerId);
  const fail = (code: SocialErrorCode) => finish(go(`${linking ? "/account/security" : "/login"}?social_error=${code}`));
  if (!consumed) return fail("expired");
  if (field(params, "error")) {
    console.error(`[social:${id}] the provider sent the person back with an error: ${plain(field(params, "error"))} ${plain(field(params, "error_reason"))} ${plain(field(params, "error_description"))}`.trim());
    return fail(field(params, "error") === "access_denied" || field(params, "error") === "user_cancelled_authorize" ? "cancelled" : "failed");
  }

  const cfg = socialConfig(id);
  const redirect = redirectUri(id);
  const code = field(params, "code");
  if (!cfg || !redirect || !code || code.length > 2000) {
    console.error(`[social:${id}] the return had no usable code, or this provider is no longer set up (keys saved: ${cfg ? "yes" : "no"}, https APP_URL: ${redirect ? "yes" : "no"})`);
    return fail("failed");
  }

  if (consumed.linkCustomerId && (await getCustomer())?.id !== consumed.linkCustomerId) return fail("expired");

  let profile;
  try {
    profile = await exchangeCode(id, cfg, { code, verifier: consumed.verifier, nonce: consumed.nonce, redirectUri: redirect, appleUser: field(params, "user") });
  } catch (e) {
    console.error(`[social:${id}] sign-in failed: ${e instanceof SocialError ? `${e.message}${e.detail ? ` (${e.detail})` : ""}` : "unexpected error"}`);
    return fail("failed");
  }

  const outcome = resolveSocialLogin(profile, { linkCustomerId: consumed.linkCustomerId, next: consumed.next });
  switch (outcome.kind) {
    case "blocked":
      return fail(outcome.reason);
    case "linked":
      return finish(go(`${consumed.next}${consumed.next.includes("?") ? "&" : "?"}linked=${id}`));
    case "signed_in":
      await startCustomerSession(outcome.customerId);
      return finish(go(consumed.next));
    case "needs_phone": {
      const res = finish(go("/register/social"));
      res.cookies.set(signupCookieName(), outcome.token, signupCookieOptions(SIGNUP_MINUTES * 60));
      return res;
    }
  }
}

/** Google and Facebook send the person back with a normal GET. */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  return handle(req, (await ctx.params).provider, new URL(req.url).searchParams);
}

/** Apple sends the person back with a form POST (response_mode=form_post). */
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const form = await req.formData().catch(() => null);
  return handle(req, (await ctx.params).provider, form ?? new URLSearchParams());
}
