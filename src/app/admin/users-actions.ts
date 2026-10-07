"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  changeOwnPassword, createAdminUser, deleteAdminUser, getAdminUser, resetAdminPassword, setAdminUserStatus, updateAdminUser,
} from "@/lib/admin-users";
import { adminAudit } from "@/lib/audit";
import { requireAdmin, requireSuper, startAdminSession } from "@/lib/auth";
import { isRole, isPermission, landingPage, type RoleKey } from "@/lib/permissions";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(str(f, k));

function back(path: string, params: Record<string, string> = {}): never {
  revalidatePath("/admin", "layout");
  const q = new URLSearchParams(params).toString();
  redirect(`${path}${q ? `?${q}` : ""}`);
}

const perms = (f: FormData) => f.getAll("perm").filter(isPermission);
const roleOf = (f: FormData): RoleKey => (isRole(str(f, "role")) ? (str(f, "role") as RoleKey) : "custom");

export async function createStaffAction(f: FormData): Promise<void> {
  const who = await requireSuper();
  const email = str(f, "email");
  const r = await createAdminUser({ email, name: str(f, "name"), password: String(f.get("password") ?? ""), role: roleOf(f), permissions: perms(f) }, who.label);
  if (!r.ok) back("/admin/users", { error: r.error });
  adminAudit(who, "staff.create", email.toLowerCase(), `role ${roleOf(f)}`);
  back(`/admin/users/${r.id}`, { created: "1" });
}

export async function updateStaffAction(f: FormData): Promise<void> {
  const who = await requireSuper();
  const id = num(f, "id");
  const before = getAdminUser(id);
  const r = updateAdminUser(id, { name: str(f, "name"), role: roleOf(f), permissions: perms(f) });
  if (!r.ok) back(`/admin/users/${id}`, { error: r.error });
  // their open sessions are cut so the new rights apply at once
  if (before) setAdminUserStatus(id, before.status);
  adminAudit(who, "staff.update", before?.email ?? `#${id}`, `role ${roleOf(f)}`);
  back(`/admin/users/${id}`, { saved: "1" });
}

export async function setStaffStatusAction(f: FormData): Promise<void> {
  const who = await requireSuper();
  const id = num(f, "id");
  const status = str(f, "status") === "ACTIVE" ? "ACTIVE" : "DISABLED";
  const u = getAdminUser(id);
  if (!u || !setAdminUserStatus(id, status)) back("/admin/users", { error: "That account no longer exists." });
  adminAudit(who, status === "ACTIVE" ? "staff.enable" : "staff.disable", u.email);
  back(`/admin/users/${id}`, { saved: "1" });
}

export async function resetStaffPasswordAction(f: FormData): Promise<void> {
  const who = await requireSuper();
  const id = num(f, "id");
  const r = await resetAdminPassword(id, String(f.get("password") ?? ""));
  if (!r.ok) back(`/admin/users/${id}`, { error: r.error });
  adminAudit(who, "staff.reset_password", getAdminUser(id)?.email ?? `#${id}`);
  back(`/admin/users/${id}`, { saved: "1", reset: "1" });
}

export async function deleteStaffAction(f: FormData): Promise<void> {
  const who = await requireSuper();
  const id = num(f, "id");
  if (f.get("confirm") !== "on") back(`/admin/users/${id}`, { error: "Tick the box to confirm you want to delete this account." });
  const u = getAdminUser(id);
  if (!u || !deleteAdminUser(id)) back("/admin/users", { error: "That account no longer exists." });
  adminAudit(who, "staff.delete", u.email);
  back("/admin/users", { saved: "1" });
}

export type PasswordState = { error?: string };

/** A staff member changing their own password, which they must do at their first sign-in. */
export async function changeOwnPasswordAction(_prev: PasswordState, f: FormData): Promise<PasswordState> {
  const who = await requireAdmin({ allowPasswordChange: true });
  if (!who.user) return { error: "The super admin password is set on the server by the developer, not here." };
  const next = String(f.get("next") ?? "");
  if (next !== String(f.get("confirm") ?? "")) return { error: "The two new passwords are not the same." };
  const r = await changeOwnPassword(who.user.id, String(f.get("current") ?? ""), next);
  if (!r.ok) return { error: r.error };
  adminAudit(who, "staff.change_password", who.user.email);
  await startAdminSession({ kind: "staff", id: who.user.id, sessionVersion: r.sessionVersion });
  revalidatePath("/admin", "layout");
  redirect(landingPage(who.permissions));
}
