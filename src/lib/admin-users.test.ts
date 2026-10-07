import { describe, expect, it } from "vitest";
import {
  authenticateStaff, changeOwnPassword, createAdminUser, deleteAdminUser, getAdminUser, listAdminUsers, resetAdminPassword, setAdminUserStatus, staffPasswordProblem, updateAdminUser,
} from "./admin-users";
import { openForTest } from "./db";
import { presetFor } from "./permissions";

const PW = "correct horse battery";

async function make(d = openForTest(), email = "Ama@Example.com", role: "support" | "custom" = "support") {
  const r = await createAdminUser({ email, name: "Ama Staff", password: PW, role, permissions: ["items.manage"] }, "super admin", d);
  if (!r.ok) throw new Error(r.error);
  return { d, id: r.id };
}

describe("creating staff accounts", () => {
  it("stores a hashed password, lower-cases the email and gives the role's rights", async () => {
    const { d, id } = await make();
    const u = getAdminUser(id, d)!;
    expect(u).toMatchObject({ email: "ama@example.com", role: "support", status: "ACTIVE", mustChangePassword: true, createdBy: "super admin" });
    expect(u.permissions).toEqual(presetFor("support"));
    const raw = d.prepare("SELECT password_hash FROM admin_users WHERE id = ?").get(id) as { password_hash: string };
    expect(raw.password_hash.startsWith("scrypt$")).toBe(true);
    expect(raw.password_hash).not.toContain(PW);
  });

  it("uses the ticked rights only for a custom role", async () => {
    const { d, id } = await make(openForTest(), "x@example.com", "custom");
    expect(getAdminUser(id, d)?.permissions).toEqual(["items.manage"]);
  });

  it("refuses a bad email, a weak password, a repeat email and an unknown role", async () => {
    const d = openForTest();
    await make(d);
    const base = { name: "Kofi", password: PW, role: "support" as const };
    expect(await createAdminUser({ ...base, email: "nope" }, "s", d)).toMatchObject({ ok: false });
    expect(await createAdminUser({ ...base, email: "k@example.com", password: "short" }, "s", d)).toMatchObject({ ok: false });
    expect(await createAdminUser({ ...base, email: "k@example.com", password: "password123" }, "s", d)).toMatchObject({ ok: false });
    expect(await createAdminUser({ ...base, email: "ama@example.com" }, "s", d)).toMatchObject({ ok: false, error: expect.stringContaining("already exists") });
    expect(await createAdminUser({ ...base, email: "k@example.com", role: "godmode" as never }, "s", d)).toMatchObject({ ok: false });
    expect(staffPasswordProblem("ama.staff1")).toBeNull();
    expect(listAdminUsers(d)).toHaveLength(1);
  });
});

describe("signing in", () => {
  it("accepts the right password, rejects wrong ones and unknown emails, and never signs in a switched-off account", async () => {
    const { d, id } = await make();
    expect(await authenticateStaff("ama@example.com", PW, d)).toMatchObject({ id });
    expect(await authenticateStaff("  AMA@example.com ", PW, d)).toMatchObject({ id });
    expect(await authenticateStaff("ama@example.com", "wrong password here", d)).toBeNull();
    expect(await authenticateStaff("nobody@example.com", PW, d)).toBeNull();
    expect(getAdminUser(id, d)?.lastLoginAt).toBeTruthy();
    setAdminUserStatus(id, "DISABLED", d);
    expect(await authenticateStaff("ama@example.com", PW, d)).toBeNull();
    setAdminUserStatus(id, "ACTIVE", d);
    expect(await authenticateStaff("ama@example.com", PW, d)).not.toBeNull();
  });
});

describe("controlling an account", () => {
  it("cuts open sessions when the account is switched off, changed or reset", async () => {
    const { d, id } = await make();
    const v = () => getAdminUser(id, d)!.sessionVersion;
    const v0 = v();
    setAdminUserStatus(id, "DISABLED", d);
    expect(v()).toBeGreaterThan(v0);
    const v1 = v();
    expect(await resetAdminPassword(id, "another long phrase", d)).toEqual({ ok: true });
    expect(v()).toBeGreaterThan(v1);
    expect(getAdminUser(id, d)?.mustChangePassword).toBe(true);
    expect(await authenticateStaff("ama@example.com", PW, d)).toBeNull();
  });

  it("changes name, role and rights, and rejects nonsense", async () => {
    const { d, id } = await make();
    expect(updateAdminUser(id, { name: "Ama Boateng", role: "custom", permissions: ["orders.manage", "users.manage" as never] }, d)).toEqual({ ok: true });
    expect(getAdminUser(id, d)).toMatchObject({ name: "Ama Boateng", role: "custom", permissions: ["orders.view", "orders.manage"] });
    expect(updateAdminUser(id, { name: "A", role: "support", permissions: [] }, d)).toMatchObject({ ok: false });
    expect(updateAdminUser(999, { name: "Nobody", role: "support", permissions: [] }, d)).toMatchObject({ ok: false });
    expect(updateAdminUser(id, { name: "Ama", role: "viewer", permissions: ["items.manage"] }, d)).toEqual({ ok: true });
    expect(getAdminUser(id, d)?.permissions).toEqual(presetFor("viewer"));
  });

  it("lets a person change their own password only with the right current one, and clears the first-time flag", async () => {
    const { d, id } = await make();
    expect(await changeOwnPassword(id, "not my password", "brand new phrase 1", d)).toMatchObject({ ok: false });
    expect(await changeOwnPassword(id, PW, PW, d)).toMatchObject({ ok: false });
    expect(await changeOwnPassword(id, PW, "short", d)).toMatchObject({ ok: false });
    const r = await changeOwnPassword(id, PW, "brand new phrase 1", d);
    expect(r).toMatchObject({ ok: true });
    expect(getAdminUser(id, d)).toMatchObject({ mustChangePassword: false });
    expect(await authenticateStaff("ama@example.com", "brand new phrase 1", d)).not.toBeNull();
    expect(await authenticateStaff("ama@example.com", PW, d)).toBeNull();
  });

  it("deletes an account", async () => {
    const { d, id } = await make();
    expect(deleteAdminUser(id, d)).toBe(true);
    expect(getAdminUser(id, d)).toBeNull();
    expect(deleteAdminUser(id, d)).toBe(false);
  });
});
