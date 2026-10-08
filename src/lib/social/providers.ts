import { createHash, createHmac, createPrivateKey, randomBytes, sign } from "node:crypto";
import type Database from "better-sqlite3";
import { appUrl } from "../app-url";
import { db } from "../db";
import { getIntegration, isConfigured, readConfig } from "../integrations";
import { toPem } from "./pem";

/**
 * Sign in with Google, Facebook or Apple, written against their documented OAuth endpoints with no extra packages.
 * Google and Apple answer with an OpenID Connect ID token, read straight from the token endpoint over TLS (which is how the
 * OpenID spec lets a server trust it), and its audience, issuer, expiry and nonce are still checked. Facebook gives an access
 * token that is exchanged for the person's profile. Nothing here touches the database except reading the saved keys.
 */
export const SOCIAL_PROVIDERS = ["google", "facebook", "apple"] as const;
export type SocialProviderId = (typeof SOCIAL_PROVIDERS)[number];
export const isSocialProvider = (v: unknown): v is SocialProviderId => (SOCIAL_PROVIDERS as readonly string[]).includes(v as string);

export const SOCIAL_LABEL: Record<SocialProviderId, string> = { google: "Google", facebook: "Facebook", apple: "Apple" };

export type SocialProfile = {
  provider: SocialProviderId;
  /** The provider's own stable id for this person. */
  subject: string;
  email: string | null;
  /** True only when the provider itself says it has verified this address. Facebook does not, so it is always false there. */
  emailVerified: boolean;
  name: string;
};

type Cfg = Record<string, string>;
export type FetchLike = typeof fetch;

/** Saved keys for a provider that is switched on and complete, or null. */
export function socialConfig(id: SocialProviderId, d: Database.Database = db(), env: NodeJS.ProcessEnv = process.env): Cfg | null {
  const def = getIntegration(id);
  if (!def) return null;
  const cfg = readConfig(def, d, env);
  return cfg.enabled && isConfigured(def, cfg, "login") ? cfg.values : null;
}

/** The sign-in buttons to show. None without APP_URL, because the providers need a fixed return address. */
export function activeSocialProviders(d: Database.Database = db(), env: NodeJS.ProcessEnv = process.env): SocialProviderId[] {
  if (!appUrl(env)) return [];
  return SOCIAL_PROVIDERS.filter((p) => socialConfig(p, d, env) !== null);
}

export function redirectUri(id: SocialProviderId, env: NodeJS.ProcessEnv = process.env): string | null {
  const base = appUrl(env);
  return base ? `${base}/api/auth/${id}/callback` : null;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest();
export const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const pkceChallenge = (verifier: string) => b64url(sha256(verifier));

export type AuthParams = { state: string; nonce: string; challenge: string; redirectUri: string };

export function authorizeUrl(id: SocialProviderId, cfg: Cfg, p: AuthParams): string {
  if (id === "google") {
    const q = new URLSearchParams({
      client_id: cfg.clientId, redirect_uri: p.redirectUri, response_type: "code", scope: "openid email profile", state: p.state, nonce: p.nonce,
      code_challenge: p.challenge, code_challenge_method: "S256", prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  if (id === "facebook") {
    const q = new URLSearchParams({ client_id: cfg.appId, redirect_uri: p.redirectUri, response_type: "code", scope: "public_profile,email", state: p.state });
    return `https://www.facebook.com/v21.0/dialog/oauth?${q}`;
  }
  const q = new URLSearchParams({
    client_id: cfg.clientId, redirect_uri: p.redirectUri, response_type: "code", response_mode: "form_post", scope: "name email", state: p.state, nonce: p.nonce,
  });
  return `https://appleid.apple.com/auth/authorize?${q}`;
}

/** Apple wants a short-lived JWT, signed with your .p8 key (ES256), in place of a client secret. */
export function appleClientSecret(cfg: Cfg, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const head = b64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId, typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: cfg.teamId, iat, exp: iat + 300, aud: "https://appleid.apple.com", sub: cfg.clientId }));
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), { key: createPrivateKey(toPem(cfg.privateKey)), dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64url(sig)}`;
}

export function decodeJwtPayload(token: unknown): Record<string, unknown> | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const v = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const truthy = (v: unknown) => v === true || v === "true";
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Checks who the token is for, who issued it, that it is current, and that it answers this very sign-in attempt. */
export function checkIdToken(payload: Record<string, unknown> | null, expect: { issuers: string[]; audience: string; nonce: string }, now = Date.now()): string | null {
  if (!payload) return "The sign-in answer could not be read.";
  if (typeof payload.iss !== "string" || !expect.issuers.includes(payload.iss)) return "The sign-in answer came from an unexpected issuer.";
  const aud = payload.aud;
  if (!(aud === expect.audience || (Array.isArray(aud) && aud.includes(expect.audience)))) return "The sign-in answer was meant for a different app.";
  if (typeof payload.exp !== "number" || payload.exp * 1000 < now - 60_000) return "The sign-in answer has expired. Please try again.";
  if (payload.nonce !== expect.nonce) return "The sign-in answer does not match this attempt.";
  if (typeof payload.sub !== "string" || !payload.sub) return "The sign-in answer had no account id.";
  return null;
}

export class SocialError extends Error {}

async function json(res: Response): Promise<Record<string, unknown>> {
  return ((await res.json().catch(() => ({}))) as Record<string, unknown>) ?? {};
}

export type ExchangeInput = { code: string; verifier: string; nonce: string; redirectUri: string; appleUser?: string };

/** Swaps the one-time code for the person's profile. Errors never contain keys, codes or tokens. */
export async function exchangeCode(id: SocialProviderId, cfg: Cfg, i: ExchangeInput, f: FetchLike = fetch, now = Date.now()): Promise<SocialProfile> {
  if (id === "facebook") return facebookProfile(cfg, i, f);
  const google = id === "google";
  const form = new URLSearchParams({
    grant_type: "authorization_code", code: i.code, redirect_uri: i.redirectUri, client_id: cfg.clientId,
    ...(google ? { client_secret: cfg.clientSecret, code_verifier: i.verifier } : { client_secret: appleClientSecret(cfg, now) }),
  });
  let res: Response;
  try {
    res = await f(google ? "https://oauth2.googleapis.com/token" : "https://appleid.apple.com/auth/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: form, signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new SocialError(`Could not reach ${SOCIAL_LABEL[id]}. Please try again.`);
  }
  const body = await json(res);
  if (!res.ok || typeof body.id_token !== "string") throw new SocialError(`${SOCIAL_LABEL[id]} did not accept the sign-in. Please try again.`);
  const payload = decodeJwtPayload(body.id_token);
  const problem = checkIdToken(payload, {
    issuers: google ? ["https://accounts.google.com", "accounts.google.com"] : ["https://appleid.apple.com"], audience: cfg.clientId, nonce: i.nonce,
  }, now);
  if (problem || !payload) throw new SocialError(problem ?? "The sign-in answer could not be read.");

  let name = text(payload.name, 80);
  if (!google && i.appleUser) {
    // Apple sends the name only once, in the browser form post, and it is not signed: it is only ever used as a suggested name.
    try {
      const u = JSON.parse(i.appleUser) as { name?: { firstName?: unknown; lastName?: unknown } };
      name = text(`${text(u.name?.firstName, 40)} ${text(u.name?.lastName, 40)}`, 80);
    } catch {
      /* no name */
    }
  }
  const email = text(payload.email, 200).toLowerCase();
  return { provider: id, subject: payload.sub as string, email: email || null, emailVerified: Boolean(email) && truthy(payload.email_verified), name };
}

async function facebookProfile(cfg: Cfg, i: ExchangeInput, f: FetchLike): Promise<SocialProfile> {
  try {
    const t = await f(
      `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({ client_id: cfg.appId, client_secret: cfg.appSecret, redirect_uri: i.redirectUri, code: i.code })}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) },
    );
    const tb = await json(t);
    if (!t.ok || typeof tb.access_token !== "string") throw new SocialError("Facebook did not accept the sign-in. Please try again.");
    const proof = createHmac("sha256", cfg.appSecret).update(tb.access_token).digest("hex");
    const p = await f(`https://graph.facebook.com/v21.0/me?${new URLSearchParams({ fields: "id,name,email", access_token: tb.access_token, appsecret_proof: proof })}`, {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000),
    });
    const pb = await json(p);
    if (!p.ok || typeof pb.id !== "string" || !pb.id) throw new SocialError("Facebook did not share your profile. Please try again.");
    const email = text(pb.email, 200).toLowerCase();
    // Facebook does not say whether an address is verified, so it is never trusted to match an existing account.
    return { provider: "facebook", subject: pb.id, email: email || null, emailVerified: false, name: text(pb.name, 80) };
  } catch (e) {
    if (e instanceof SocialError) throw e;
    throw new SocialError("Could not reach Facebook. Please try again.");
  }
}
