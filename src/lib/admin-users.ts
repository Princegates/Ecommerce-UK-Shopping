import type Database from "better-sqlite3";
import { db } from "./db";
import { burnPasswordCheck, hashPassword, passwordProblem, verifyPassword } from "./password";
import { isRole, normalizePermissions, presetFor, type Permission, type RoleKey } from "./permissions";

type Db = Database.Database;

export type AdminUser = {
  id: number; email: string; name: string; role: RoleKey; permissions: Permission[]; status: "ACTIVE" | "DISABLED";
  mustChangePassword: boolean; sessionVersion: number; createdBy: string; createdAt: string; lastLoginAt: string | null;
};

type Raw = {
  id: number; email: string; name: string; role: string; permissions: string; status: string; must_change_password: number;
  session_version: number; created_by: string; created_at: string; last_login_at: string | null; password_hash?: string;
};

function toUser(r: Raw): AdminUser {
  let perms: unknown = [];
  try { perms = JSON.parse(r.permissions); } catch { /* an unreadable list means no rights */ }
  return {
    id: r.id, email: r.email, name: r.name, role: isRole(r.role) ? r.role : "custom", permissions: normalizePermissions(perms),
    status: r.status === "DISABLED" ? "DISABLED" : "ACTIVE", mustChangePassword: r.must_change_password === 1, sessionVersion: r.session_version,
    createdBy: r.created_by, createdAt: r.created_at, lastLoginAt: r.last_login_at,
  };
}

export const normalizeEmail = (v: string) => v.trim().toLowerCase();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Staff passwords are held to a higher bar than shoppers': 10 characters or more. */
export function staffPasswordProblem(password: string, who: { email?: string; name?: string } = {}): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  return passwordProblem(password, { email: who.email, name: who.name });
}

export function getAdminUser(id: number, d: Db = db()): AdminUser | null {
  const r = d.prepare("SELECT * FROM admin_users WHERE id = ?").get(id) as Raw | undefined;
  return r ? toUser(r) : null;
}

export function listAdminUsers(d: Db = db()): AdminUser[] {
  return (d.prepare("SELECT * FROM admin_users ORDER BY status, name COLLATE NOCASE").all() as Raw[]).map(toUser);
}

export type NewUser = { email: string; name: string; password: string; role: RoleKey; permissions?: Permission[] };

export async function createAdminUser(i: NewUser, createdBy: string, d: Db = db()): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const email = normalizeEmail(i.email);
  const name = i.name.trim();
  if (!EMAIL.test(email) || email.length > 120) return { ok: false, error: "Enter a valid email address." };
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Enter the person's name (2 to 80 characters)." };
  if (!isRole(i.role)) return { ok: false, error: "Choose a role." };
  const problem = staffPasswordProblem(i.password, { email, name });
  if (problem) return { ok: false, error: problem };
  if (d.prepare("SELECT 1 FROM admin_users WHERE email = ?").get(email)) return { ok: false, error: "A staff account with that email already exists." };
  const perms = i.role === "custom" ? normalizePermissions(i.permissions ?? []) : presetFor(i.role);
  const hash = await hashPassword(i.password);
  const info = d
    .prepare("INSERT INTO admin_users (email, name, password_hash, role, permissions, created_by) VALUES (?, ?, ?, ?, ?, ?)")
    .run(email, name, hash, i.role, JSON.stringify(perms), createdBy.slice(0, 120));
  return { ok: true, id: Number(info.lastInsertRowid) };
}

/** Changes a person's name, role and rights. Their open sessions are cut so the new rights apply at once. */
export function updateAdminUser(
  id: number, i: { name: string; role: RoleKey; permissions: Permission[] }, d: Db = db(),
): { ok: true } | { ok: false; error: string } {
  const name = i.name.trim();
  if (!getAdminUser(id, d)) return { ok: false, error: "That account no longer exists." };
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Enter the person's name (2 to 80 characters)." };
  if (!isRole(i.role)) return { ok: false, error: "Choose a role." };
  const perms = i.role === "custom" ? normalizePermissions(i.permissions) : presetFor(i.role);
  d.prepare("UPDATE admin_users SET name = ?, role = ?, permissions = ? WHERE id = ?").run(name, i.role, JSON.stringify(perms), id);
  return { ok: true };
}

export function setAdminUserStatus(id: number, status: "ACTIVE" | "DISABLED", d: Db = db()): boolean {
  // bumping the session version signs the person out everywhere straight away
  return d.prepare("UPDATE admin_users SET status = ?, session_version = session_version + 1 WHERE id = ?").run(status, id).changes > 0;
}

export function deleteAdminUser(id: number, d: Db = db()): boolean {
  return d.prepare("DELETE FROM admin_users WHERE id = ?").run(id).changes > 0;
}

/** Sets a new password chosen by the super admin; the person must change it at their next sign-in. */
export async function resetAdminPassword(id: number, password: string, d: Db = db()): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = getAdminUser(id, d);
  if (!u) return { ok: false, error: "That account no longer exists." };
  const problem = staffPasswordProblem(password, u);
  if (problem) return { ok: false, error: problem };
  d.prepare("UPDATE admin_users SET password_hash = ?, must_change_password = 1, session_version = session_version + 1 WHERE id = ?").run(await hashPassword(password), id);
  return { ok: true };
}

/** A person changing their own password. Other sessions are signed out; the caller starts a fresh one. */
export async function changeOwnPassword(id: number, current: string, next: string, d: Db = db()): Promise<{ ok: true; sessionVersion: number } | { ok: false; error: string }> {
  const row = d.prepare("SELECT * FROM admin_users WHERE id = ?").get(id) as Raw | undefined;
  if (!row || row.status !== "ACTIVE") return { ok: false, error: "That account is not available." };
  if (!(await verifyPassword(current, row.password_hash ?? ""))) return { ok: false, error: "Your current password is not right." };
  if (current === next) return { ok: false, error: "Choose a new password that is different from the current one." };
  const problem = staffPasswordProblem(next, { email: row.email, name: row.name });
  if (problem) return { ok: false, error: problem };
  d.prepare("UPDATE admin_users SET password_hash = ?, must_change_password = 0, session_version = session_version + 1 WHERE id = ?").run(await hashPassword(next), id);
  return { ok: true, sessionVersion: (d.prepare("SELECT session_version AS v FROM admin_users WHERE id = ?").get(id) as { v: number }).v };
}

/** Checks an email and password. An unknown email costs the same time as a wrong password. */
export async function authenticateStaff(email: string, password: string, d: Db = db()): Promise<AdminUser | null> {
  const row = d.prepare("SELECT * FROM admin_users WHERE email = ?").get(normalizeEmail(email)) as Raw | undefined;
  if (!row) {
    await burnPasswordCheck(password);
    return null;
  }
  const ok = await verifyPassword(password, row.password_hash ?? "");
  if (!ok || row.status !== "ACTIVE") return null;
  d.prepare("UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?").run(row.id);
  return toUser(row);
}
