import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { migrate, openForTest } from "../db";
import { SCHEMA } from "../schema";
import Database from "better-sqlite3";
import { createResetToken, deleteAccount, getCustomerById, registerCustomer, resetPassword } from "../customers";
import { getIntegration, readConfig, saveFields, setEnabled } from "../integrations";
import { beginAuth, completeSocialSignup, consumeState, getPendingSignup, listIdentities, resolveSocialLogin } from "./flow";
import { pemBody, toPem } from "./pem";
import {
  activeSocialProviders, appleClientSecret, authorizeUrl, checkIdToken, decodeJwtPayload, exchangeCode, pkceChallenge, providerReason, redirectUri, SocialError,
  socialConfig, type SocialProfile,
} from "./providers";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (payload: Record<string, unknown>) => `${b64({ alg: "RS256" })}.${b64(payload)}.sig`;
const NOW = Date.parse("2026-10-08T12:00:00Z");
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("pem helpers", () => {
  it("rebuilds a key pasted with lost line breaks, or written with \\n", () => {
    const body = "MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg".repeat(3);
    const oneLine = `-----BEGIN PRIVATE KEY-----${body}-----END PRIVATE KEY-----`;
    expect(pemBody(oneLine)).toBe(body);
    expect(pemBody(`-----BEGIN PRIVATE KEY-----\\n${body}\\n-----END PRIVATE KEY-----\\n`)).toBe(body);
    expect(toPem(body)).toMatch(/^-----BEGIN PRIVATE KEY-----\n[A-Za-z0-9+/=\n]+\n-----END PRIVATE KEY-----\n$/);
    expect(pemBody(toPem(body))).toBe(body);
  });
});

const GOOGLE = { clientId: "g-client.apps.googleusercontent.com", clientSecret: "g-secret" };
const FB = { appId: "123456", appSecret: "fb-secret" };
const EC = generateKeyPairSync("ec", { namedCurve: "P-256" });
const APPLE = { clientId: "com.example.shop.web", teamId: "TEAM123456", keyId: "KEY1234567", privateKey: pemBody(EC.privateKey.export({ type: "pkcs8", format: "pem" }).toString()) };
const P = { state: "st", nonce: "nn", challenge: "ch", redirectUri: "https://shop.example/api/auth/google/callback" };

describe("authorize addresses", () => {
  it("asks Google for openid email profile with PKCE and the nonce", () => {
    const u = new URL(authorizeUrl("google", GOOGLE, P));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ client_id: GOOGLE.clientId, response_type: "code", scope: "openid email profile", state: "st", nonce: "nn", code_challenge: "ch", code_challenge_method: "S256", redirect_uri: P.redirectUri });
  });
  it("asks Facebook for the public profile and email", () => {
    const u = new URL(authorizeUrl("facebook", FB, P));
    expect(u.origin + u.pathname).toBe("https://www.facebook.com/v21.0/dialog/oauth");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ client_id: "123456", scope: "public_profile,email", state: "st" });
  });
  it("asks Apple for a form post, which is required to receive the name and email", () => {
    const u = new URL(authorizeUrl("apple", APPLE, P));
    expect(u.origin + u.pathname).toBe("https://appleid.apple.com/auth/authorize");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ client_id: APPLE.clientId, response_mode: "form_post", scope: "name email", nonce: "nn" });
  });
  it("derives the PKCE challenge from the verifier", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("Apple client secret", () => {
  it("is an ES256 JWT for the team, signed with the saved key (even when stored as a bare base64 body)", () => {
    const secret = appleClientSecret(APPLE, NOW);
    const [h, b, s] = secret.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "ES256", kid: "KEY1234567", typ: "JWT" });
    expect(JSON.parse(Buffer.from(b, "base64url").toString())).toEqual({ iss: "TEAM123456", iat: NOW / 1000, exp: NOW / 1000 + 300, aud: "https://appleid.apple.com", sub: "com.example.shop.web" });
    expect(verify("sha256", Buffer.from(`${h}.${b}`), { key: EC.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"))).toBe(true);
  });
});

describe("id token checks", () => {
  const ok = { iss: "https://accounts.google.com", aud: GOOGLE.clientId, exp: NOW / 1000 + 600, nonce: "n1", sub: "u1" };
  const expect1 = { issuers: ["https://accounts.google.com"], audience: GOOGLE.clientId, nonce: "n1" };
  it("accepts a good token and names the problem with a bad one", () => {
    expect(checkIdToken(ok, expect1, NOW)).toBeNull();
    expect(checkIdToken({ ...ok, aud: [GOOGLE.clientId, "other"] }, expect1, NOW)).toBeNull();
    expect(checkIdToken({ ...ok, iss: "https://evil.example" }, expect1, NOW)).toMatch(/issuer/);
    expect(checkIdToken({ ...ok, aud: "someone-else" }, expect1, NOW)).toMatch(/different app/);
    expect(checkIdToken({ ...ok, exp: NOW / 1000 - 3600 }, expect1, NOW)).toMatch(/expired/);
    expect(checkIdToken({ ...ok, nonce: "n2" }, expect1, NOW)).toMatch(/does not match/);
    expect(checkIdToken({ ...ok, sub: "" }, expect1, NOW)).toMatch(/no account id/);
    expect(checkIdToken(null, expect1, NOW)).toMatch(/could not be read/);
  });
  it("reads only well-formed token payloads", () => {
    expect(decodeJwtPayload(jwt({ a: 1 }))).toEqual({ a: 1 });
    expect(decodeJwtPayload("a.b")).toBeNull();
    expect(decodeJwtPayload("a.!!!.c")).toBeNull();
    expect(decodeJwtPayload(null)).toBeNull();
  });
});

describe("exchanging the code for a profile", () => {
  const input = { code: "the-code", verifier: "ver", nonce: "n1", redirectUri: "https://shop.example/api/auth/google/callback" };

  it("Google: sends the secret and verifier, and reads a verified email and name", async () => {
    let body = new URLSearchParams();
    const f = (async (_u: unknown, init: RequestInit) => {
      body = new URLSearchParams(String(init.body));
      return reply(200, { id_token: jwt({ iss: "accounts.google.com", aud: GOOGLE.clientId, exp: NOW / 1000 + 600, nonce: "n1", sub: "g-123", email: "Ama@Example.com", email_verified: true, name: "Ama Mensah" }) });
    }) as unknown as typeof fetch;
    const p = await exchangeCode("google", GOOGLE, input, f, NOW);
    expect(p).toEqual({ provider: "google", subject: "g-123", email: "ama@example.com", emailVerified: true, name: "Ama Mensah" });
    expect(Object.fromEntries(body)).toMatchObject({ grant_type: "authorization_code", code: "the-code", code_verifier: "ver", client_secret: "g-secret", client_id: GOOGLE.clientId });
  });

  it("Google: refuses a token for another app or another attempt, and an unaccepted code, without leaking secrets", async () => {
    const claims = { iss: "https://accounts.google.com", aud: GOOGLE.clientId, exp: NOW / 1000 + 600, nonce: "n1", sub: "g-123" };
    const mk = (extra: Record<string, unknown>) => (async () => reply(200, { id_token: jwt({ ...claims, ...extra }) })) as unknown as typeof fetch;
    await expect(exchangeCode("google", GOOGLE, input, mk({ aud: "other" }), NOW)).rejects.toBeInstanceOf(SocialError);
    await expect(exchangeCode("google", GOOGLE, input, mk({ nonce: "other" }), NOW)).rejects.toBeInstanceOf(SocialError);
    const err = await exchangeCode("google", GOOGLE, input, (async () => reply(400, { error: "invalid_grant" })) as unknown as typeof fetch, NOW).catch((e) => e as Error);
    expect((err as Error).message).toMatch(/did not accept/);
    expect((err as Error).message).not.toContain("g-secret");
    await expect(exchangeCode("google", GOOGLE, input, (async () => { throw new Error("down g-secret"); }) as unknown as typeof fetch, NOW)).rejects.toThrow(/Could not reach Google/);
  });

  it("Apple: signs its own client secret, treats the string 'true' as verified, and uses the one-time name only as a suggestion", async () => {
    let body = new URLSearchParams();
    const f = (async (u: unknown, init: RequestInit) => {
      expect(String(u)).toBe("https://appleid.apple.com/auth/token");
      body = new URLSearchParams(String(init.body));
      return reply(200, { id_token: jwt({ iss: "https://appleid.apple.com", aud: APPLE.clientId, exp: NOW / 1000 + 600, nonce: "n1", sub: "apple-001", email: "x@privaterelay.appleid.com", email_verified: "true", name: "Ignored Signed Name" }) });
    }) as unknown as typeof fetch;
    const p = await exchangeCode("apple", APPLE, { ...input, appleUser: JSON.stringify({ name: { firstName: "Kofi", lastName: "Boateng" }, email: "attacker@evil.example" }) }, f, NOW);
    expect(p).toEqual({ provider: "apple", subject: "apple-001", email: "x@privaterelay.appleid.com", emailVerified: true, name: "Kofi Boateng" });
    expect(body.get("client_secret")?.split(".")).toHaveLength(3);
    expect(body.get("code_verifier")).toBeNull();
    const none = await exchangeCode("apple", APPLE, { ...input, appleUser: "not json" }, f, NOW);
    expect(none.name).toBe("Ignored Signed Name");
  });

  it("Facebook: exchanges the code, then reads the profile with a proof, and never treats the email as verified", async () => {
    const calls: string[] = [];
    const f = (async (u: unknown) => {
      const url = String(u);
      calls.push(url);
      if (url.includes("/oauth/access_token")) return reply(200, { access_token: "fb-token" });
      return reply(200, { id: "fb-77", name: "Yaa Asantewaa", email: "Yaa@Example.com" });
    }) as unknown as typeof fetch;
    const p = await exchangeCode("facebook", FB, input, f, NOW);
    expect(p).toEqual({ provider: "facebook", subject: "fb-77", email: "yaa@example.com", emailVerified: false, name: "Yaa Asantewaa" });
    const me = new URL(calls[1]);
    expect(me.searchParams.get("fields")).toBe("id,name,email");
    expect(me.searchParams.get("appsecret_proof")).toMatch(/^[0-9a-f]{64}$/);
    const noEmail = await exchangeCode("facebook", FB, input, (async (u: unknown) => (String(u).includes("/oauth/access_token") ? reply(200, { access_token: "t" }) : reply(200, { id: "fb-78", name: "No Email" }))) as unknown as typeof fetch, NOW);
    expect(noEmail.email).toBeNull();
    await expect(exchangeCode("facebook", FB, input, (async () => reply(400, { error: {} })) as unknown as typeof fetch, NOW)).rejects.toThrow(/Facebook did not accept/);
  });
});

describe("saying why a provider refused, for the server log only", () => {
  it("reads Facebook's, Google's and Apple's error shapes", () => {
    expect(providerReason(400, { error: { message: "Error validating client secret.", type: "OAuthException", code: 1, fbtrace_id: "abc" } })).toBe("HTTP 400, Error validating client secret., code 1, OAuthException");
    expect(providerReason(400, { error: "invalid_grant", error_description: "Bad Request" })).toBe("HTTP 400, invalid_grant, Bad Request");
    expect(providerReason(500, {})).toBe("HTTP 500");
    expect(providerReason(400, { error: "x\nforged log line <script>" })).not.toMatch(/[\n<>]/);
  });
  it("puts it in the detail of the error, never in the message shown to a customer", async () => {
    const f = (async () => reply(400, { error: { message: "Error validating client secret.", type: "OAuthException", code: 1 } })) as unknown as typeof fetch;
    const err = (await exchangeCode("facebook", FB, { code: "c", verifier: "v", nonce: "n", redirectUri: "https://shop.example/api/auth/facebook/callback" }, f, NOW).catch((e) => e)) as SocialError;
    expect(err).toBeInstanceOf(SocialError);
    expect(err.message).toBe("Facebook did not accept the sign-in. Please try again.");
    expect(err.detail).toBe("token exchange: HTTP 400, Error validating client secret., code 1, OAuthException");
    expect(JSON.stringify([err.message, err.detail])).not.toContain(FB.appSecret);
    const g = (await exchangeCode("google", GOOGLE, { code: "c", verifier: "v", nonce: "n", redirectUri: "https://shop.example/api/auth/google/callback" }, (async () => reply(401, { error: "invalid_client", error_description: "Unauthorized" })) as unknown as typeof fetch, NOW).catch((e) => e)) as SocialError;
    expect(g.detail).toBe("HTTP 401, invalid_client, Unauthorized");
    expect(g.detail).not.toContain(GOOGLE.clientSecret);
  });
});

describe("which buttons show", () => {
  // production rules, with the same key the tests save with (outside production a development key is used)
  const noUrl = { NODE_ENV: "production", SETTINGS_ENCRYPTION_KEY: "dev-only-secret-change-me-0000" } as unknown as NodeJS.ProcessEnv;
  const env = { ...noUrl, APP_URL: "https://shop.example" } as unknown as NodeJS.ProcessEnv;
  it("shows only providers that are complete and switched on, and none without a fixed site address", () => {
    const d = openForTest();
    expect(activeSocialProviders(d, env)).toEqual([]);
    expect(saveFields(getIntegration("google")!, GOOGLE, d).ok).toBe(true);
    saveFields(getIntegration("facebook")!, { appId: "123456" }, d); // missing secret: not complete
    expect(activeSocialProviders(d, env)).toEqual(["google"]);
    setEnabled(getIntegration("google")!, false, d);
    expect(activeSocialProviders(d, env)).toEqual([]);
    setEnabled(getIntegration("google")!, true, d);
    expect(activeSocialProviders(d, noUrl)).toEqual([]);
    expect(redirectUri("apple", env)).toBe("https://shop.example/api/auth/apple/callback");
    expect(redirectUri("apple", noUrl)).toBeNull();
    expect(socialConfig("google", d, env)).toMatchObject({ clientId: GOOGLE.clientId, clientSecret: "g-secret" });
  });
  it("saves a pasted Apple key as its base64 body and the key still signs", () => {
    const d = openForTest();
    const pem = EC.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    expect(saveFields(getIntegration("apple")!, { ...APPLE, privateKey: pem.replace(/\n/g, " ") }, d)).toMatchObject({ ok: true });
    const cfg = readConfig(getIntegration("apple")!, d);
    expect(cfg.values.privateKey).toBe(APPLE.privateKey);
    expect(appleClientSecret(cfg.values, NOW).split(".")).toHaveLength(3);
  });
});

const profile = (over: Partial<SocialProfile> = {}): SocialProfile => ({ provider: "google", subject: "g-1", email: "ama@example.com", emailVerified: true, name: "Ama Mensah", ...over });

describe("sign-in attempts", () => {
  it("can be completed once, only from the browser that began it, and only for its own provider", () => {
    const d = openForTest();
    const b = beginAuth("google", { next: "/checkout" }, d);
    expect(consumeState("google", b.state, "wrong-binding", d)).toBeNull();
    expect(consumeState("google", b.state, b.binding, d)).toBeNull(); // the failed try used it up
    const c = beginAuth("google", { next: "/checkout" }, d);
    expect(consumeState("facebook", c.state, c.binding, d)).toBeNull();
    const e = beginAuth("google", { next: "/checkout", linkCustomerId: 5 }, d);
    expect(consumeState("google", e.state, e.binding, d)).toEqual({ nonce: e.nonce, verifier: e.verifier, next: "/checkout", linkCustomerId: 5 });
    expect(consumeState("google", e.state, e.binding, d)).toBeNull();
    expect(pkceChallenge(e.verifier)).toBe(e.challenge);
  });
  it("expires, and stores only hashes of the state and binding", () => {
    const d = openForTest();
    const b = beginAuth("google", { next: "/" }, d);
    const row = d.prepare("SELECT * FROM oauth_states").get() as Record<string, string>;
    expect(JSON.stringify(row)).not.toContain(b.state);
    expect(JSON.stringify(row)).not.toContain(b.binding);
    d.prepare("UPDATE oauth_states SET expires_at = datetime('now', '-1 minute')").run();
    expect(consumeState("google", b.state, b.binding, d)).toBeNull();
  });
});

async function existing(d: ReturnType<typeof openForTest>, email = "ama@example.com", phone = "0241234567") {
  const r = await registerCustomer({ name: "Ama Mensah", phone, email, password: "correct horse battery" }, d);
  if (!r.ok) throw new Error(r.error);
  return r.customer;
}

describe("matching a provider profile to an account", () => {
  const o = { linkCustomerId: null, next: "/account" };

  it("sends a stranger to add a phone number, then creates the account with the identity and a verified email", async () => {
    const d = openForTest();
    const out = resolveSocialLogin(profile(), o, d);
    expect(out.kind).toBe("needs_phone");
    if (out.kind !== "needs_phone") return;
    expect(getPendingSignup(out.token, d)).toEqual({ provider: "google", name: "Ama Mensah", email: "ama@example.com", next: "/account" });
    const done = await completeSocialSignup(out.token, { name: "Ama Mensah", phone: "024 123 4567" }, d);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.customer).toMatchObject({ name: "Ama Mensah", phone: "+233241234567", email: "ama@example.com", status: "ACTIVE" });
    expect(listIdentities(done.customer.id, d)).toMatchObject([{ provider: "google", email: "ama@example.com" }]);
    expect(getPendingSignup(out.token, d)).toBeNull();
    expect((await completeSocialSignup(out.token, { name: "Ama", phone: "0245550000" }, d)).ok).toBe(false);
    // the next time, the identity alone signs them in
    expect(resolveSocialLogin(profile({ email: "changed@example.com" }), o, d)).toEqual({ kind: "signed_in", customerId: done.customer.id });
  });

  it("keeps an unverified (Facebook) email off the new account", async () => {
    const d = openForTest();
    const out = resolveSocialLogin(profile({ provider: "facebook", subject: "fb-1", emailVerified: false }), o, d);
    if (out.kind !== "needs_phone") throw new Error("expected needs_phone");
    const done = await completeSocialSignup(out.token, { name: "Ama Mensah", phone: "0241234567" }, d);
    expect(done.ok && done.customer.email).toBeNull();
  });

  it("signs in the owner of a verified email and connects the provider, but never trusts an unverified one", async () => {
    const d = openForTest();
    const c = await existing(d);
    expect(resolveSocialLogin(profile({ provider: "facebook", subject: "fb-9", emailVerified: false }), o, d)).toEqual({ kind: "blocked", reason: "email_in_use" });
    expect(listIdentities(c.id, d)).toEqual([]);
    expect(resolveSocialLogin(profile(), o, d)).toEqual({ kind: "signed_in", customerId: c.id });
    expect(listIdentities(c.id, d)).toHaveLength(1);
  });

  it("never signs in or links a switched-off account", async () => {
    const d = openForTest();
    const c = await existing(d);
    d.prepare("UPDATE customers SET status = 'DISABLED' WHERE id = ?").run(c.id);
    expect(resolveSocialLogin(profile(), o, d)).toEqual({ kind: "blocked", reason: "disabled" });
    d.prepare("UPDATE customers SET status = 'ACTIVE' WHERE id = ?").run(c.id);
    expect(resolveSocialLogin(profile(), o, d)).toMatchObject({ kind: "signed_in" });
    d.prepare("UPDATE customers SET status = 'DISABLED' WHERE id = ?").run(c.id);
    expect(resolveSocialLogin(profile(), o, d)).toEqual({ kind: "blocked", reason: "disabled" });
  });

  it("never takes over an account by phone number", async () => {
    const d = openForTest();
    await existing(d, "other@example.com", "0241234567");
    const out = resolveSocialLogin(profile({ email: null, emailVerified: false }), o, d);
    if (out.kind !== "needs_phone") throw new Error("expected needs_phone");
    const done = await completeSocialSignup(out.token, { name: "Someone Else", phone: "024 123 4567" }, d);
    expect(done).toMatchObject({ ok: false, error: expect.stringContaining("already exists") });
    expect(d.prepare("SELECT COUNT(*) AS n FROM customer_identities").get()).toEqual({ n: 0 });
  });

  it("connects a provider to the signed-in customer, and refuses one already used by someone else", async () => {
    const d = openForTest();
    const me = await existing(d, "me@example.com", "0241111111");
    const other = await existing(d, "other@example.com", "0242222222");
    expect(resolveSocialLogin(profile({ email: "different@example.com" }), { linkCustomerId: me.id, next: "/account/security" }, d)).toEqual({ kind: "linked", customerId: me.id });
    expect(resolveSocialLogin(profile(), { linkCustomerId: me.id, next: "/" }, d)).toEqual({ kind: "linked", customerId: me.id });
    expect(resolveSocialLogin(profile(), { linkCustomerId: other.id, next: "/" }, d)).toEqual({ kind: "blocked", reason: "already_linked" });
    expect(listIdentities(me.id, d)).toHaveLength(1);
    expect(listIdentities(other.id, d)).toHaveLength(0);
  });

  it("keeps the identity table consistent when an account is deleted, and rejects short names and bad phones", async () => {
    const d = openForTest();
    const out = resolveSocialLogin(profile(), o, d);
    if (out.kind !== "needs_phone") throw new Error("expected needs_phone");
    expect(await completeSocialSignup(out.token, { name: "A", phone: "0241234567" }, d)).toMatchObject({ ok: false, error: "Enter your full name." });
    expect(await completeSocialSignup(out.token, { name: "Ama Mensah", phone: "12" }, d)).toMatchObject({ ok: false });
    expect(await completeSocialSignup("nope", { name: "Ama Mensah", phone: "0241234567" }, d)).toMatchObject({ ok: false, expired: true });
    const done = await completeSocialSignup(out.token, { name: "Ama Mensah", phone: "0241234567" }, d);
    if (!done.ok) throw new Error(done.error);
    d.prepare("DELETE FROM customers WHERE id = ?").run(done.customer.id);
    expect(d.prepare("SELECT COUNT(*) AS n FROM customer_identities").get()).toEqual({ n: 0 });
    expect(getCustomerById(done.customer.id, d)).toBeNull();
  });
});

describe("accounts made with a provider have no password", () => {
  const o = { linkCustomerId: null, next: "/account" };
  async function socialCustomer(d: ReturnType<typeof openForTest>) {
    const out = resolveSocialLogin(profile(), o, d);
    if (out.kind !== "needs_phone") throw new Error("expected needs_phone");
    const done = await completeSocialSignup(out.token, { name: "Ama Mensah", phone: "0241234567" }, d);
    if (!done.ok) throw new Error(done.error);
    return done.customer;
  }

  it("can delete the account without a password, which removes the identity too", async () => {
    const d = openForTest();
    const c = await socialCustomer(d);
    expect(c.hasPassword).toBe(false);
    expect(await deleteAccount(c.id, "", d)).toEqual({ ok: true });
    expect(getCustomerById(c.id, d)).toBeNull();
    expect(d.prepare("SELECT COUNT(*) AS n FROM customer_identities").get()).toEqual({ n: 0 });
  });

  it("asks for the password once one has been chosen", async () => {
    const d = openForTest();
    const c = await socialCustomer(d);
    const reset = await resetPassword(createResetToken(c.id, d), "a long unusual passphrase 481", d);
    expect(reset.ok).toBe(true);
    expect(getCustomerById(c.id, d)?.hasPassword).toBe(true);
    expect(await deleteAccount(c.id, "", d)).toMatchObject({ ok: false, error: "Your password is not right." });
    expect(await deleteAccount(c.id, "a long unusual passphrase 481", d)).toEqual({ ok: true });
  });

  it("still needs the password for an ordinary account", async () => {
    const d = openForTest();
    const r = await registerCustomer({ name: "Kofi Boateng", phone: "0245550100", email: "", password: "correct horse battery" }, d);
    if (!r.ok) throw new Error(r.error);
    expect(r.customer.hasPassword).toBe(true);
    expect(await deleteAccount(r.customer.id, "", d)).toMatchObject({ ok: false });
    expect(await deleteAccount(r.customer.id, "correct horse battery", d)).toEqual({ ok: true });
  });

  it("is added to a database made before it, treating every existing account as having a password", () => {
    const d = new Database(":memory:");
    d.pragma("foreign_keys = ON");
    d.exec(SCHEMA.replace("  password_set     INTEGER NOT NULL DEFAULT 1,\n", ""));
    expect((d.prepare("PRAGMA table_info(customers)").all() as { name: string }[]).some((c) => c.name === "password_set")).toBe(false);
    d.prepare("INSERT INTO customers (name, phone, password_hash) VALUES ('Old Customer', '+233240000000', 'x')").run();
    migrate(d);
    expect(d.prepare("SELECT password_set FROM customers").get()).toEqual({ password_set: 1 });
  });
});

