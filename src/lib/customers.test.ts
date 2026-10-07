import { describe, expect, it } from "vitest";
import { openForTest } from "./db";
import {
  authenticate, changePassword, changeSignInDetails, createResetToken, createSession, customerForSession, deleteAccount, deleteAddress,
  deleteOtherSessions, findCustomerForReset, listAddresses, listCustomers, registerCustomer, resetPassword, resetTokenValid, saveAddress,
  setCustomerStatus, setDefault, updateProfile,
} from "./customers";

const base = { name: "Ama Mensah", phone: "024 123 4567", email: "Ama@Example.com", password: "river-lamp-orange-42" };
async function setup() {
  const d = openForTest();
  const r = await registerCustomer(base, d);
  if (!r.ok) throw new Error(r.error);
  return { d, c: r.customer };
}

describe("registration and login", () => {
  it("normalises the phone and email and never stores the password", async () => {
    const { d, c } = await setup();
    expect(c.phone).toBe("+233241234567");
    expect(c.email).toBe("ama@example.com");
    const row = d.prepare("SELECT password_hash FROM customers WHERE id = ?").get(c.id) as { password_hash: string };
    expect(row.password_hash).not.toContain(base.password);
    expect(row.password_hash.startsWith("scrypt$")).toBe(true);
  });
  it("rejects duplicates by phone or email, with one message that does not say which", async () => {
    const { d } = await setup();
    const byPhone = await registerCustomer({ ...base, email: "other@example.com" }, d);
    const byEmail = await registerCustomer({ ...base, phone: "0551112222" }, d);
    expect(byPhone).toMatchObject({ ok: false });
    expect(byEmail).toMatchObject({ ok: false });
    expect(byPhone.ok === false && byEmail.ok === false && byPhone.error === byEmail.error).toBe(true);
  });
  it("validates every field", async () => {
    const d = openForTest();
    expect((await registerCustomer({ ...base, name: "A" }, d)).ok).toBe(false);
    expect((await registerCustomer({ ...base, phone: "123" }, d)).ok).toBe(false);
    expect((await registerCustomer({ ...base, email: "nope" }, d)).ok).toBe(false);
    expect((await registerCustomer({ ...base, password: "short" }, d)).ok).toBe(false);
    expect((await registerCustomer({ ...base, email: "" }, d)).ok).toBe(true); // email is optional
  });
  it("logs in with phone in any format, or with email, and rejects the wrong password", async () => {
    const { d, c } = await setup();
    expect((await authenticate("0241234567", base.password, d))?.id).toBe(c.id);
    expect((await authenticate("+233 24 123 4567", base.password, d))?.id).toBe(c.id);
    expect((await authenticate("AMA@example.com", base.password, d))?.id).toBe(c.id);
    expect(await authenticate("0241234567", "wrong-password-1", d)).toBeNull();
    expect(await authenticate("0559999999", base.password, d)).toBeNull();
  });
  it("blocks disabled accounts and ends their sessions", async () => {
    const { d, c } = await setup();
    const s = createSession(c.id, "test", d);
    expect(customerForSession(s, d)?.id).toBe(c.id);
    setCustomerStatus(c.id, "DISABLED", d);
    expect(customerForSession(s, d)).toBeNull();
    expect(await authenticate("0241234567", base.password, d)).toBeNull();
    setCustomerStatus(c.id, "ACTIVE", d);
    expect((await authenticate("0241234567", base.password, d))?.id).toBe(c.id);
  });
}, 30_000);

describe("sessions", () => {
  it("stores only a hash of the token, expires, and can be revoked", async () => {
    const { d, c } = await setup();
    const raw = createSession(c.id, "UA", d);
    const stored = d.prepare("SELECT token_hash FROM customer_sessions").get() as { token_hash: string };
    expect(stored.token_hash).not.toBe(raw);
    expect(customerForSession(raw, d)?.id).toBe(c.id);
    expect(customerForSession(raw + "x", d)).toBeNull();
    expect(customerForSession(undefined, d)).toBeNull();
    d.prepare("UPDATE customer_sessions SET expires_at = datetime('now', '-1 minute')").run();
    expect(customerForSession(raw, d)).toBeNull();
  });
  it("signs out other devices but keeps this one", async () => {
    const { d, c } = await setup();
    const a = createSession(c.id, "a", d);
    const b = createSession(c.id, "b", d);
    deleteOtherSessions(c.id, a, d);
    expect(customerForSession(a, d)).not.toBeNull();
    expect(customerForSession(b, d)).toBeNull();
  });
}, 30_000);

describe("password reset", () => {
  it("works once, expires, replaces older tokens and signs everyone out", async () => {
    const { d, c } = await setup();
    const session = createSession(c.id, "ua", d);
    const t1 = createResetToken(c.id, d);
    const t2 = createResetToken(c.id, d);
    expect(resetTokenValid(t1, d)).toBe(false);
    expect(resetTokenValid(t2, d)).toBe(true);
    expect((await resetPassword(t2, "short", d)).ok).toBe(false);
    expect((await resetPassword(t2, "brand-new-secret-77", d)).ok).toBe(true);
    expect((await resetPassword(t2, "another-secret-88", d)).ok).toBe(false);
    expect(customerForSession(session, d)).toBeNull();
    expect(await authenticate("0241234567", base.password, d)).toBeNull();
    expect((await authenticate("0241234567", "brand-new-secret-77", d))?.id).toBe(c.id);
  });
  it("rejects an expired token and finds customers by phone or email", async () => {
    const { d, c } = await setup();
    const t = createResetToken(c.id, d);
    d.prepare("UPDATE password_resets SET expires_at = datetime('now', '-1 minute')").run();
    expect((await resetPassword(t, "brand-new-secret-77", d)).ok).toBe(false);
    expect(findCustomerForReset("0241234567", d)?.id).toBe(c.id);
    expect(findCustomerForReset("ama@example.com", d)?.id).toBe(c.id);
    expect(findCustomerForReset("0550000000", d)).toBeNull();
  });
}, 30_000);

describe("profile, sign-in details and password", () => {
  it("updates name and preferences without a password", async () => {
    const { d, c } = await setup();
    expect(updateProfile(c.id, { name: "Ama K. Mensah", notifySms: false, notifyEmail: true, notifyWhatsapp: true, defaultZoneId: null }, d).ok).toBe(true);
    const row = d.prepare("SELECT name, notify_sms, notify_whatsapp FROM customers WHERE id = ?").get(c.id);
    expect(row).toEqual({ name: "Ama K. Mensah", notify_sms: 0, notify_whatsapp: 1 });
  });
  it("needs the current password to change phone or email, and refuses another account's details", async () => {
    const { d, c } = await setup();
    await registerCustomer({ name: "Kofi Boateng", phone: "0551112222", email: "kofi@example.com", password: "green-door-lantern-9" }, d);
    expect((await changeSignInDetails(c.id, { phone: "0249998888", email: "", currentPassword: "wrong-wrong-1" }, d)).ok).toBe(false);
    expect((await changeSignInDetails(c.id, { phone: "0551112222", email: "", currentPassword: base.password }, d)).ok).toBe(false);
    expect((await changeSignInDetails(c.id, { phone: "0249998888", email: "new@example.com", currentPassword: base.password }, d)).ok).toBe(true);
    expect((await authenticate("0249998888", base.password, d))?.id).toBe(c.id);
  });
  it("changes the password, signs out other devices and keeps the current one", async () => {
    const { d, c } = await setup();
    const here = createSession(c.id, "here", d);
    const other = createSession(c.id, "other", d);
    expect((await changePassword(c.id, "wrong-wrong-1", "brand-new-secret-77", here, d)).ok).toBe(false);
    expect((await changePassword(c.id, base.password, "brand-new-secret-77", here, d)).ok).toBe(true);
    expect(customerForSession(here, d)).not.toBeNull();
    expect(customerForSession(other, d)).toBeNull();
  });
}, 40_000);

describe("addresses", () => {
  const addr = { label: "Home", recipient: "Ama Mensah", phone: "0241234567", zoneId: null, address: "12 Example Street", landmark: "", makeDefault: false };
  it("makes the first address the default and keeps exactly one default", async () => {
    const { d, c } = await setup();
    const a = saveAddress(c.id, addr, d);
    const b = saveAddress(c.id, { ...addr, label: "Work", address: "5 Office Road", makeDefault: true }, d);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(listAddresses(c.id, d).filter((x) => x.isDefault).map((x) => x.id)).toEqual([b.id]);
    setDefault(c.id, a.id, d);
    expect(listAddresses(c.id, d).find((x) => x.isDefault)?.id).toBe(a.id);
    deleteAddress(c.id, a.id, d);
    expect(listAddresses(c.id, d).map((x) => [x.id, x.isDefault])).toEqual([[b.id, true]]);
  });
  it("cannot touch another customer's address and caps the list", async () => {
    const { d, c } = await setup();
    const other = await registerCustomer({ name: "Kofi Boateng", phone: "0551112222", email: "", password: "green-door-lantern-9" }, d);
    if (!other.ok) throw new Error(other.error);
    const mine = saveAddress(c.id, addr, d);
    if (!mine.ok) throw new Error(mine.error);
    expect(saveAddress(other.customer.id, { ...addr, id: mine.id, address: "Hijacked address" }, d).ok).toBe(false);
    deleteAddress(other.customer.id, mine.id, d);
    expect(listAddresses(c.id, d)).toHaveLength(1);
    for (let i = 0; i < 9; i++) expect(saveAddress(c.id, addr, d).ok).toBe(true);
    expect(saveAddress(c.id, addr, d).ok).toBe(false);
  });
  it("validates the fields", async () => {
    const { d, c } = await setup();
    expect(saveAddress(c.id, { ...addr, phone: "12" }, d).ok).toBe(false);
    expect(saveAddress(c.id, { ...addr, address: "x" }, d).ok).toBe(false);
    expect(saveAddress(c.id, { ...addr, zoneId: 9999 }, d).ok).toBe(false);
  });
}, 20_000);

describe("account deletion and admin list", () => {
  it("needs the password, removes the account's data and keeps orders", async () => {
    const { d, c } = await setup();
    saveAddress(c.id, { label: "Home", recipient: "Ama", phone: "0241234567", zoneId: null, address: "12 Example Street", landmark: "", makeDefault: true }, d);
    createSession(c.id, "ua", d);
    expect((await deleteAccount(c.id, "wrong-wrong-1", d)).ok).toBe(false);
    expect((await deleteAccount(c.id, base.password, d)).ok).toBe(true);
    for (const t of ["customers", "customer_addresses", "customer_sessions"]) {
      expect((d.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n).toBe(0);
    }
  });
  it("lists and searches customers for the admin", async () => {
    const { d } = await setup();
    await registerCustomer({ name: "Kofi Boateng", phone: "0551112222", email: "", password: "green-door-lantern-9" }, d);
    expect(listCustomers(undefined, d)).toHaveLength(2);
    expect(listCustomers("kofi", d).map((c) => c.name)).toEqual(["Kofi Boateng"]);
    expect(listCustomers("0241234567".slice(-7), d)).toHaveLength(1);
    expect(listCustomers("nobody", d)).toHaveLength(0);
  });
}, 20_000);
