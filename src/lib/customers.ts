import type Database from "better-sqlite3";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { isEmail, toE164 } from "./notify/phone";
import { burnPasswordCheck, hashPassword, passwordProblem, verifyPassword } from "./password";

type Db = Database.Database;

export const SESSION_DAYS = 30;
export const RESET_MINUTES = 60;
const MAX_ADDRESSES = 10;

export type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  notifySms: boolean;
  notifyEmail: boolean;
  notifyWhatsapp: boolean;
  defaultZoneId: number | null;
  /** False for an account made with Google, Facebook or Apple that has not chosen a password. */
  hasPassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

type Raw = {
  id: number; name: string; phone: string; email: string | null; status: string; notify_sms: number; notify_email: number;
  notify_whatsapp: number; default_zone_id: number | null; password_set?: number; created_at: string; last_login_at: string | null;
};

const toCustomer = (r: Raw): Customer => ({
  id: r.id, name: r.name, phone: r.phone, email: r.email, status: r.status, notifySms: r.notify_sms === 1,
  notifyEmail: r.notify_email === 1, notifyWhatsapp: r.notify_whatsapp === 1, defaultZoneId: r.default_zone_id, hasPassword: r.password_set !== 0,
  createdAt: r.created_at, lastLoginAt: r.last_login_at,
});

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const token = () => randomBytes(32).toString("base64url");

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

export function getCustomerById(id: number, d: Db = db()): Customer | null {
  const r = d.prepare("SELECT * FROM customers WHERE id = ?").get(id) as Raw | undefined;
  return r ? toCustomer(r) : null;
}

/** Customers log in with a phone number or an email address. */
function findByIdentifier(identifier: string, d: Db): (Raw & { password_hash: string }) | undefined {
  const id = identifier.trim();
  if (id.includes("@")) {
    return d.prepare("SELECT * FROM customers WHERE email = ?").get(id.toLowerCase()) as (Raw & { password_hash: string }) | undefined;
  }
  const phone = toE164(id);
  return phone ? (d.prepare("SELECT * FROM customers WHERE phone = ?").get(phone) as (Raw & { password_hash: string }) | undefined) : undefined;
}

export type RegisterInput = { name: string; phone: string; email: string; password: string };

const EXISTS = "An account with these details already exists. Sign in, or reset your password if you have forgotten it.";

export async function registerCustomer(input: RegisterInput, d: Db = db()): Promise<Result<{ customer: Customer }>> {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Enter your full name." };
  const phone = toE164(input.phone);
  if (!phone) return { ok: false, error: "Enter a valid phone number, for example 024 123 4567." };
  const email = input.email.trim().toLowerCase();
  if (email && !isEmail(email)) return { ok: false, error: "Enter a valid email address, or leave it blank." };
  const problem = passwordProblem(input.password, { phone, email, name });
  if (problem) return { ok: false, error: problem };

  if (d.prepare("SELECT 1 FROM customers WHERE phone = ? OR (? <> '' AND email = ?)").get(phone, email, email)) {
    await burnPasswordCheck(input.password);
    return { ok: false, error: EXISTS };
  }
  const hash = await hashPassword(input.password);
  try {
    const info = d
      .prepare("INSERT INTO customers (name, phone, email, password_hash) VALUES (?, ?, ?, ?)")
      .run(name, phone, email || null, hash);
    return { ok: true, customer: getCustomerById(Number(info.lastInsertRowid), d)! };
  } catch {
    return { ok: false, error: EXISTS }; // lost a race with another sign-up
  }
}

/** Returns the customer when the credentials are right and the account is active. Same cost either way. */
export async function authenticate(identifier: string, password: string, d: Db = db()): Promise<Customer | null> {
  const row = findByIdentifier(identifier, d);
  if (!row) {
    await burnPasswordCheck(password);
    return null;
  }
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok || row.status !== "ACTIVE") return null;
  d.prepare("UPDATE customers SET last_login_at = datetime('now') WHERE id = ?").run(row.id);
  return toCustomer(row);
}

// ------------------------------------------------------------------ sessions

export function createSession(customerId: number, userAgent: string, d: Db = db()): string {
  d.prepare("DELETE FROM customer_sessions WHERE expires_at < datetime('now')").run();
  const raw = token();
  d.prepare("INSERT INTO customer_sessions (token_hash, customer_id, expires_at, user_agent) VALUES (?, ?, datetime('now', ?), ?)").run(
    sha(raw), customerId, `+${SESSION_DAYS} days`, userAgent.slice(0, 200),
  );
  return raw;
}

export function customerForSession(raw: string | undefined, d: Db = db()): Customer | null {
  if (!raw || raw.length < 20 || raw.length > 100) return null;
  const r = d
    .prepare(
      `SELECT c.* FROM customer_sessions s JOIN customers c ON c.id = s.customer_id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND c.status = 'ACTIVE'`,
    )
    .get(sha(raw)) as Raw | undefined;
  return r ? toCustomer(r) : null;
}

export function deleteSession(raw: string, d: Db = db()): void {
  d.prepare("DELETE FROM customer_sessions WHERE token_hash = ?").run(sha(raw));
}

/** Sign out everywhere, optionally keeping the session the person is using now. */
export function deleteOtherSessions(customerId: number, keepRaw: string | null, d: Db = db()): void {
  if (keepRaw) d.prepare("DELETE FROM customer_sessions WHERE customer_id = ? AND token_hash <> ?").run(customerId, sha(keepRaw));
  else d.prepare("DELETE FROM customer_sessions WHERE customer_id = ?").run(customerId);
}

export function sessionCount(customerId: number, d: Db = db()): number {
  return (d.prepare("SELECT COUNT(*) AS n FROM customer_sessions WHERE customer_id = ? AND expires_at > datetime('now')").get(customerId) as { n: number }).n;
}

// ------------------------------------------------------------ password reset

export function findCustomerForReset(identifier: string, d: Db = db()): Customer | null {
  const r = findByIdentifier(identifier, d);
  return r && r.status === "ACTIVE" ? toCustomer(r) : null;
}

/** A single-use link token, valid for an hour. Any earlier unused token stops working. */
export function createResetToken(customerId: number, d: Db = db()): string {
  d.prepare("DELETE FROM password_resets WHERE customer_id = ? OR expires_at < datetime('now', '-1 day')").run(customerId);
  const raw = token();
  d.prepare("INSERT INTO password_resets (token_hash, customer_id, expires_at) VALUES (?, ?, datetime('now', ?))").run(
    sha(raw), customerId, `+${RESET_MINUTES} minutes`,
  );
  return raw;
}

export function resetTokenValid(raw: string, d: Db = db()): boolean {
  return Boolean(
    d.prepare("SELECT 1 FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')").get(sha(raw)),
  );
}

export async function resetPassword(raw: string, newPassword: string, d: Db = db()): Promise<Result<{ customer: Customer }>> {
  const row = d
    .prepare("SELECT customer_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')")
    .get(sha(raw)) as { customer_id: number } | undefined;
  if (!row) return { ok: false, error: "This reset link has expired or was already used. Ask for a new one." };
  const customer = getCustomerById(row.customer_id, d);
  if (!customer || customer.status !== "ACTIVE") return { ok: false, error: "This reset link has expired or was already used. Ask for a new one." };
  const problem = passwordProblem(newPassword, { phone: customer.phone, email: customer.email ?? "", name: customer.name });
  if (problem) return { ok: false, error: problem };
  const hash = await hashPassword(newPassword);
  const run = d.transaction(() => {
    const used = d.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE token_hash = ? AND used_at IS NULL").run(sha(raw));
    if (used.changes === 0) return false;
    d.prepare("UPDATE customers SET password_hash = ?, password_set = 1 WHERE id = ?").run(hash, customer.id);
    d.prepare("DELETE FROM customer_sessions WHERE customer_id = ?").run(customer.id);
    return true;
  });
  return run() ? { ok: true, customer } : { ok: false, error: "This reset link has expired or was already used. Ask for a new one." };
}

// -------------------------------------------------------------------- profile

export function updateProfile(
  id: number,
  p: { name: string; notifySms: boolean; notifyEmail: boolean; notifyWhatsapp: boolean; defaultZoneId: number | null },
  d: Db = db(),
): Result<object> {
  const name = p.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Enter your full name." };
  d.prepare("UPDATE customers SET name = ?, notify_sms = ?, notify_email = ?, notify_whatsapp = ?, default_zone_id = ? WHERE id = ?").run(
    name, p.notifySms ? 1 : 0, p.notifyEmail ? 1 : 0, p.notifyWhatsapp ? 1 : 0, p.defaultZoneId, id,
  );
  return { ok: true };
}

async function passwordIs(id: number, password: string, d: Db): Promise<boolean> {
  const r = d.prepare("SELECT password_hash FROM customers WHERE id = ?").get(id) as { password_hash: string } | undefined;
  if (!r) return false;
  return verifyPassword(password, r.password_hash);
}

/** Phone and email are how people sign in and recover accounts, so changing them needs the password. */
export async function changeSignInDetails(
  id: number,
  input: { phone: string; email: string; currentPassword: string },
  d: Db = db(),
): Promise<Result<object>> {
  if (!(await passwordIs(id, input.currentPassword, d))) return { ok: false, error: "Your current password is not right." };
  const phone = toE164(input.phone);
  if (!phone) return { ok: false, error: "Enter a valid phone number, for example 024 123 4567." };
  const email = input.email.trim().toLowerCase();
  if (email && !isEmail(email)) return { ok: false, error: "Enter a valid email address, or leave it blank." };
  if (d.prepare("SELECT 1 FROM customers WHERE id <> ? AND (phone = ? OR (? <> '' AND email = ?))").get(id, phone, email, email)) {
    return { ok: false, error: "Another account already uses that phone number or email." };
  }
  d.prepare("UPDATE customers SET phone = ?, email = ? WHERE id = ?").run(phone, email || null, id);
  return { ok: true };
}

export async function changePassword(
  id: number,
  current: string,
  next: string,
  keepSessionRaw: string | null,
  d: Db = db(),
): Promise<Result<object>> {
  if (!(await passwordIs(id, current, d))) return { ok: false, error: "Your current password is not right." };
  const c = getCustomerById(id, d);
  if (!c) return { ok: false, error: "Account not found." };
  const problem = passwordProblem(next, { phone: c.phone, email: c.email ?? "", name: c.name });
  if (problem) return { ok: false, error: problem };
  d.prepare("UPDATE customers SET password_hash = ?, password_set = 1 WHERE id = ?").run(await hashPassword(next), id);
  deleteOtherSessions(id, keepSessionRaw, d);
  return { ok: true };
}

/** Removes the profile, addresses, saved items and sessions. Orders stay for our records, unlinked from the account. */
export async function deleteAccount(id: number, password: string, d: Db = db()): Promise<Result<object>> {
  // an account made with Google, Facebook or Apple has no password to ask for: being signed in and typing DELETE is the confirmation
  if (getCustomerById(id, d)?.hasPassword !== false && !(await passwordIs(id, password, d))) return { ok: false, error: "Your password is not right." };
  d.transaction(() => {
    d.prepare("UPDATE reviews SET author = 'Former customer' WHERE customer_id = ?").run(id);
    d.prepare("UPDATE link_requests SET customer_id = NULL WHERE customer_id = ?").run(id);
    d.prepare("DELETE FROM customers WHERE id = ?").run(id);
  })();
  return { ok: true };
}

// ------------------------------------------------------------------ addresses

export type Address = {
  id: number; label: string; recipient: string; phone: string; zoneId: number | null; address: string; landmark: string; isDefault: boolean;
};

type RawAddress = { id: number; label: string; recipient: string; phone: string; zone_id: number | null; address: string; landmark: string; is_default: number };

const toAddress = (r: RawAddress): Address => ({
  id: r.id, label: r.label, recipient: r.recipient, phone: r.phone, zoneId: r.zone_id, address: r.address, landmark: r.landmark, isDefault: r.is_default === 1,
});

export function listAddresses(customerId: number, d: Db = db()): Address[] {
  return (d.prepare("SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id").all(customerId) as RawAddress[]).map(toAddress);
}

export type AddressInput = { id?: number; label: string; recipient: string; phone: string; zoneId: number | null; address: string; landmark: string; makeDefault: boolean };

export function saveAddress(customerId: number, a: AddressInput, d: Db = db()): Result<{ id: number }> {
  const label = a.label.trim().slice(0, 30) || "Home";
  const recipient = a.recipient.trim();
  const address = a.address.trim();
  const phone = toE164(a.phone);
  if (recipient.length < 2) return { ok: false, error: "Enter the name of the person receiving the order." };
  if (!phone) return { ok: false, error: "Enter a valid phone number for the rider to call." };
  if (address.length < 5) return { ok: false, error: "Enter the delivery address." };
  if (a.zoneId !== null && !d.prepare("SELECT 1 FROM delivery_zones WHERE id = ?").get(a.zoneId)) return { ok: false, error: "Choose a delivery area." };

  const run = d.transaction((): number => {
    let id = a.id ?? 0;
    if (id) {
      const mine = d.prepare("SELECT 1 FROM customer_addresses WHERE id = ? AND customer_id = ?").get(id, customerId);
      if (!mine) throw new Error("not yours");
      d.prepare("UPDATE customer_addresses SET label=?, recipient=?, phone=?, zone_id=?, address=?, landmark=? WHERE id = ?").run(
        label, recipient, phone, a.zoneId, address, a.landmark.trim().slice(0, 150), id,
      );
    } else {
      const n = (d.prepare("SELECT COUNT(*) AS n FROM customer_addresses WHERE customer_id = ?").get(customerId) as { n: number }).n;
      if (n >= MAX_ADDRESSES) throw new Error("limit");
      const info = d
        .prepare("INSERT INTO customer_addresses (customer_id, label, recipient, phone, zone_id, address, landmark, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(customerId, label, recipient, phone, a.zoneId, address, a.landmark.trim().slice(0, 150), n === 0 ? 1 : 0);
      id = Number(info.lastInsertRowid);
    }
    if (a.makeDefault) setDefault(customerId, id, d);
    return id;
  });
  try {
    return { ok: true, id: run() };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message === "limit" ? `You can save up to ${MAX_ADDRESSES} addresses.` : "That address could not be saved." };
  }
}

export function setDefault(customerId: number, addressId: number, d: Db = db()): void {
  d.transaction(() => {
    d.prepare("UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?").run(customerId);
    d.prepare("UPDATE customer_addresses SET is_default = 1 WHERE id = ? AND customer_id = ?").run(addressId, customerId);
  })();
}

export function deleteAddress(customerId: number, addressId: number, d: Db = db()): void {
  d.transaction(() => {
    const was = d.prepare("SELECT is_default FROM customer_addresses WHERE id = ? AND customer_id = ?").get(addressId, customerId) as { is_default: number } | undefined;
    if (!was) return;
    d.prepare("DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?").run(addressId, customerId);
    if (was.is_default === 1) {
      d.prepare("UPDATE customer_addresses SET is_default = 1 WHERE id = (SELECT id FROM customer_addresses WHERE customer_id = ? ORDER BY id LIMIT 1)").run(customerId);
    }
  })();
}

// ---------------------------------------------------------------------- admin

export type CustomerSummary = Customer & { orderCount: number; spentMinor: number };

export function listCustomers(q: string | undefined, d: Db = db()): CustomerSummary[] {
  const like = `%${(q ?? "").trim().toLowerCase().replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const rows = d
    .prepare(
      `SELECT c.*,
         (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count,
         (SELECT COALESCE(SUM(o.total_minor), 0) FROM orders o WHERE o.customer_id = c.id AND o.payment_status = 'PAID') AS spent
       FROM customers c
       WHERE ? = '%%' OR LOWER(c.name) LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\' OR LOWER(COALESCE(c.email, '')) LIKE ? ESCAPE '\\'
       ORDER BY c.id DESC LIMIT 300`,
    )
    .all(like, like, like, like) as (Raw & { order_count: number; spent: number })[];
  return rows.map((r) => ({ ...toCustomer(r), orderCount: r.order_count, spentMinor: r.spent }));
}

export function setCustomerStatus(id: number, status: "ACTIVE" | "DISABLED", d: Db = db()): void {
  d.transaction(() => {
    d.prepare("UPDATE customers SET status = ? WHERE id = ?").run(status, id);
    if (status === "DISABLED") d.prepare("DELETE FROM customer_sessions WHERE customer_id = ?").run(id);
  })();
}

// -------------------------------------------------------------------- updates

export type UpdateItem = { orderNumber: string; paymentRef: string; status: string; note: string; at: string; isNew: boolean };

/** Everything that has happened on the customer's orders, newest first. */
export function updatesFeed(customerId: number, limit = 50, d: Db = db()): UpdateItem[] {
  const seen = (d.prepare("SELECT updates_seen_at AS t FROM customers WHERE id = ?").get(customerId) as { t: string | null } | undefined)?.t ?? "";
  const rows = d
    .prepare(
      `SELECT o.number, o.payment_ref, e.status, e.note, e.created_at
       FROM order_events e JOIN orders o ON o.id = e.order_id
       WHERE o.customer_id = ? ORDER BY e.id DESC LIMIT ?`,
    )
    .all(customerId, limit) as { number: string; payment_ref: string; status: string; note: string; created_at: string }[];
  return rows.map((r) => ({ orderNumber: r.number, paymentRef: r.payment_ref, status: r.status, note: r.note, at: r.created_at, isNew: r.created_at > seen }));
}

export function unseenUpdateCount(customerId: number, d: Db = db()): number {
  const r = d
    .prepare(
      `SELECT COUNT(*) AS n FROM order_events e JOIN orders o ON o.id = e.order_id
       WHERE o.customer_id = ? AND e.created_at > COALESCE((SELECT updates_seen_at FROM customers WHERE id = ?), '')
         AND e.note <> 'Order placed'`,
    )
    .get(customerId, customerId) as { n: number };
  return r.n;
}

export function markUpdatesSeen(customerId: number, d: Db = db()): void {
  d.prepare("UPDATE customers SET updates_seen_at = datetime('now') WHERE id = ?").run(customerId);
}

export function setDefaultZone(customerId: number, zoneId: number | null, d: Db = db()): void {
  d.prepare("UPDATE customers SET default_zone_id = ? WHERE id = ?").run(zoneId, customerId);
}
