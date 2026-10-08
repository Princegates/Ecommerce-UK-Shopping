import { createHash, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";
import { getCustomerById, type Customer } from "../customers";
import { db } from "../db";
import { toE164 } from "../notify/phone";
import { hashPassword } from "../password";
import { pkceChallenge, randomToken, type SocialProfile, type SocialProviderId } from "./providers";

type Db = Database.Database;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const STATE_MINUTES = 10;
export const SIGNUP_MINUTES = 30;

export type Begun = { state: string; binding: string; nonce: string; verifier: string; challenge: string };

/** Starts one sign-in attempt. The state goes to the provider, the binding goes into the browser's cookie, and only hashes are stored. */
export function beginAuth(provider: SocialProviderId, o: { next: string; linkCustomerId?: number | null }, d: Db = db()): Begun {
  d.prepare("DELETE FROM oauth_states WHERE expires_at < datetime('now')").run();
  const b: Begun = { state: randomToken(24), binding: randomToken(24), nonce: randomToken(16), verifier: randomToken(48), challenge: "" };
  b.challenge = pkceChallenge(b.verifier);
  d.prepare(
    "INSERT INTO oauth_states (state_hash, provider, binding_hash, nonce, verifier, next_path, link_customer_id, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))",
  ).run(sha(b.state), provider, sha(b.binding), b.nonce, b.verifier, o.next.slice(0, 300), o.linkCustomerId ?? null, `+${STATE_MINUTES} minutes`);
  return b;
}

export type Consumed = { nonce: string; verifier: string; next: string; linkCustomerId: number | null };

/** Single use: the attempt is gone after this call whether or not it matches. It must be the same browser that started it. */
export function consumeState(provider: SocialProviderId, state: string, binding: string, d: Db = db()): Consumed | null {
  if (!state || !binding || state.length > 200 || binding.length > 200) return null;
  const row = d.transaction(() => {
    const r = d.prepare("SELECT * FROM oauth_states WHERE state_hash = ? AND expires_at > datetime('now')").get(sha(state)) as
      | { provider: string; binding_hash: string; nonce: string; verifier: string; next_path: string; link_customer_id: number | null }
      | undefined;
    d.prepare("DELETE FROM oauth_states WHERE state_hash = ?").run(sha(state));
    return r;
  })();
  if (!row || row.provider !== provider || !same(row.binding_hash, sha(binding))) return null;
  return { nonce: row.nonce, verifier: row.verifier, next: row.next_path, linkCustomerId: row.link_customer_id };
}

export type BlockReason = "disabled" | "email_in_use" | "already_linked";
export type Outcome =
  | { kind: "signed_in"; customerId: number }
  | { kind: "linked"; customerId: number }
  | { kind: "needs_phone"; token: string }
  | { kind: "blocked"; reason: BlockReason };

const addIdentity = (customerId: number, p: SocialProfile, d: Db) =>
  d.prepare("INSERT INTO customer_identities (customer_id, provider, subject, email) VALUES (?, ?, ?, ?)").run(customerId, p.provider, p.subject, p.email ?? "");

const touch = (id: number, d: Db) => d.prepare("UPDATE customers SET last_login_at = datetime('now') WHERE id = ?").run(id);

/**
 * Decides what a verified provider profile means here. An account is matched by the provider's own id, or by email only when the
 * provider says it verified that email (Google, Apple). Phone numbers and unverified emails are never used to take over an account.
 */
export function resolveSocialLogin(p: SocialProfile, o: { linkCustomerId: number | null; next: string }, d: Db = db()): Outcome {
  const found = d.prepare("SELECT customer_id FROM customer_identities WHERE provider = ? AND subject = ?").get(p.provider, p.subject) as { customer_id: number } | undefined;
  if (o.linkCustomerId) {
    if (found) return found.customer_id === o.linkCustomerId ? { kind: "linked", customerId: found.customer_id } : { kind: "blocked", reason: "already_linked" };
    const me = getCustomerById(o.linkCustomerId, d);
    if (!me || me.status !== "ACTIVE") return { kind: "blocked", reason: "disabled" };
    addIdentity(me.id, p, d);
    return { kind: "linked", customerId: me.id };
  }
  if (found) {
    const c = getCustomerById(found.customer_id, d);
    if (!c || c.status !== "ACTIVE") return { kind: "blocked", reason: "disabled" };
    touch(c.id, d);
    return { kind: "signed_in", customerId: c.id };
  }
  if (p.email) {
    const owner = d.prepare("SELECT id, status FROM customers WHERE email = ?").get(p.email) as { id: number; status: string } | undefined;
    if (owner) {
      if (!p.emailVerified) return { kind: "blocked", reason: "email_in_use" };
      if (owner.status !== "ACTIVE") return { kind: "blocked", reason: "disabled" };
      addIdentity(owner.id, p, d);
      touch(owner.id, d);
      return { kind: "signed_in", customerId: owner.id };
    }
  }
  d.prepare("DELETE FROM social_signups WHERE expires_at < datetime('now')").run();
  const token = randomToken(32);
  d.prepare("INSERT INTO social_signups (token_hash, provider, subject, name, email, email_verified, next_path, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))").run(
    sha(token), p.provider, p.subject, p.name, p.email ?? "", p.emailVerified ? 1 : 0, o.next.slice(0, 300), `+${SIGNUP_MINUTES} minutes`,
  );
  return { kind: "needs_phone", token };
}

export type PendingSignup = { provider: SocialProviderId; name: string; email: string; next: string };

export function getPendingSignup(raw: string | undefined, d: Db = db()): PendingSignup | null {
  if (!raw || raw.length > 200) return null;
  const r = d.prepare("SELECT provider, name, email, next_path FROM social_signups WHERE token_hash = ? AND expires_at > datetime('now')").get(sha(raw)) as
    | { provider: SocialProviderId; name: string; email: string; next_path: string }
    | undefined;
  return r ? { provider: r.provider, name: r.name, email: r.email, next: r.next_path } : null;
}

const PHONE_TAKEN = "An account with this phone number already exists. Sign in with your password, then connect this sign-in from Account > Security.";

/** Creates the account once the person has given the phone number we need to reach them about deliveries. */
export async function completeSocialSignup(raw: string, input: { name: string; phone: string }, d: Db = db()): Promise<{ ok: true; customer: Customer; next: string } | { ok: false; error: string; expired?: boolean }> {
  const row = d.prepare("SELECT * FROM social_signups WHERE token_hash = ? AND expires_at > datetime('now')").get(sha(raw)) as
    | { provider: string; subject: string; email: string; email_verified: number; next_path: string }
    | undefined;
  if (!row) return { ok: false, error: "This sign-in took too long. Please start again.", expired: true };
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Enter your full name." };
  const phone = toE164(input.phone);
  if (!phone) return { ok: false, error: "Enter a valid phone number, for example 024 123 4567." };
  if (d.prepare("SELECT 1 FROM customers WHERE phone = ?").get(phone)) return { ok: false, error: PHONE_TAKEN };
  // The unknowable password means the account can only be entered through its social sign-in until the person chooses a password via "Forgot password".
  const hash = await hashPassword(randomToken(32));
  try {
    const id = d.transaction(() => {
      if (d.prepare("SELECT 1 FROM customer_identities WHERE provider = ? AND subject = ?").get(row.provider, row.subject)) throw new Error("done");
      const email = row.email && row.email_verified === 1 && !d.prepare("SELECT 1 FROM customers WHERE email = ?").get(row.email) ? row.email : null;
      const info = d.prepare("INSERT INTO customers (name, phone, email, password_hash, password_set, last_login_at) VALUES (?, ?, ?, ?, 0, datetime('now'))").run(name, phone, email, hash);
      const customerId = Number(info.lastInsertRowid);
      d.prepare("INSERT INTO customer_identities (customer_id, provider, subject, email) VALUES (?, ?, ?, ?)").run(customerId, row.provider, row.subject, row.email);
      d.prepare("DELETE FROM social_signups WHERE token_hash = ?").run(sha(raw));
      return customerId;
    })();
    return { ok: true, customer: getCustomerById(id, d)!, next: row.next_path };
  } catch {
    return { ok: false, error: PHONE_TAKEN };
  }
}

export type Identity = { provider: SocialProviderId; email: string; createdAt: string };

export function listIdentities(customerId: number, d: Db = db()): Identity[] {
  return (d.prepare("SELECT provider, email, created_at FROM customer_identities WHERE customer_id = ? ORDER BY id").all(customerId) as { provider: SocialProviderId; email: string; created_at: string }[]).map((r) => ({
    provider: r.provider, email: r.email, createdAt: r.created_at,
  }));
}
