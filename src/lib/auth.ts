import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAdminUser, type AdminUser } from "./admin-users";
import { PERMISSION_KEYS, type Permission } from "./permissions";
import { createLimiter } from "./throttle";

const COOKIE = "admin_session";
const TTL_SECONDS = 60 * 60 * 8;

type AdminConfig = { password: string; secret: string; isDevDefault: boolean };

/**
 * Admin credentials come from ADMIN_PASSWORD and ADMIN_SECRET. Outside production
 * a dev default is used so the project runs out of the box; in production the
 * admin area stays locked until both are set.
 */
export function adminConfig(): AdminConfig | null {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SECRET;
  if (password && secret && secret.length >= 16) return { password, secret, isDevDefault: false };
  if (process.env.NODE_ENV !== "production") {
    return { password: "admin", secret: "dev-only-secret-change-me-0000", isDevDefault: true };
  }
  return null;
}

const sha = (s: string) => createHash("sha256").update(s).digest();

export function passwordMatches(input: string, expected: string): boolean {
  return timingSafeEqual(sha(input), sha(expected));
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function makeToken(secret: string, now = Date.now()): string {
  const expires = Math.floor(now / 1000) + TTL_SECONDS;
  const nonce = randomBytes(8).toString("base64url");
  const payload = `${expires}.${nonce}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyToken(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expires, nonce, sig] = parts;
  const expected = sign(`${expires}.${nonce}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Number(expires) > Math.floor(now / 1000);
}

// --- staff sessions ---------------------------------------------------------------
// A staff token is "u.<id>.<session version>.<expires>.<nonce>.<signature>". The session version lives on the account, so
// disabling someone, changing their rights or resetting their password ends their open sessions at once.

export function makeStaffToken(secret: string, id: number, sessionVersion: number, now = Date.now()): string {
  const expires = Math.floor(now / 1000) + TTL_SECONDS;
  const payload = `u.${id}.${sessionVersion}.${expires}.${randomBytes(8).toString("base64url")}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyStaffToken(token: string | undefined, secret: string, now = Date.now()): { id: number; sessionVersion: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 6 || parts[0] !== "u") return null;
  const [, id, sv, expires, nonce, sig] = parts;
  const expected = sign(`u.${id}.${sv}.${expires}.${nonce}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!(Number(expires) > Math.floor(now / 1000))) return null;
  const idN = Number(id);
  const svN = Number(sv);
  return Number.isInteger(idN) && idN > 0 && Number.isInteger(svN) ? { id: idN, sessionVersion: svN } : null;
}

/** Who is signed in. The super admin can do everything; a staff member can do what their account allows. */
export type AdminIdentity = {
  kind: "super" | "staff";
  isSuper: boolean;
  /** shown in the activity log */
  label: string;
  name: string;
  user: AdminUser | null;
  permissions: ReadonlySet<Permission>;
};

export const can = (who: AdminIdentity, p: Permission): boolean => who.isSuper || who.permissions.has(p);

export const SUPER_IDENTITY: AdminIdentity = { kind: "super", isSuper: true, label: "super admin", name: "Super admin", user: null, permissions: new Set(PERMISSION_KEYS) };

export function staffIdentity(user: AdminUser): AdminIdentity {
  return { kind: "staff", isSuper: false, label: `${user.name} (${user.email})`, name: user.name, user, permissions: new Set(user.permissions) };
}

/** Looks at the cookie once per request and checks the account is still active and its session version still matches. */
export const getAdmin = cache(async (): Promise<AdminIdentity | null> => {
  const cfg = adminConfig();
  if (!cfg) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (verifyToken(token, cfg.secret)) return SUPER_IDENTITY;
  const staff = verifyStaffToken(token, cfg.secret);
  if (!staff) return null;
  const user = getAdminUser(staff.id);
  if (!user || user.status !== "ACTIVE" || user.sessionVersion !== staff.sessionVersion) return null;
  return staffIdentity(user);
});

export async function isAdmin(): Promise<boolean> {
  return (await getAdmin()) !== null;
}

/**
 * Call at the top of every admin page and every admin server action that needs no particular right (it signs the person in, and
 * sends a staff member whose password was set by someone else to choose their own first).
 */
export async function requireAdmin(opts: { allowPasswordChange?: boolean } = {}): Promise<AdminIdentity> {
  const who = await getAdmin();
  if (!who) redirect("/admin/login");
  if (who.user?.mustChangePassword && !opts.allowPasswordChange) redirect("/admin/account?must=1");
  return who;
}

/** Call at the top of every admin page and action that needs a specific right. Returns who is acting, for the activity log. */
export async function requirePermission(p: Permission): Promise<AdminIdentity> {
  const who = await requireAdmin();
  if (!can(who, p)) redirect("/admin/no-access");
  return who;
}

/** For staff management: only the super admin, never a staff account. */
export async function requireSuper(): Promise<AdminIdentity> {
  const who = await requireAdmin();
  if (!who.isSuper) redirect("/admin/no-access");
  return who;
}

export async function startAdminSession(who: { kind: "super" } | { kind: "staff"; id: number; sessionVersion: number } = { kind: "super" }): Promise<void> {
  const cfg = adminConfig();
  if (!cfg) throw new Error("Admin is not configured");
  const jar = await cookies();
  jar.set(COOKIE, who.kind === "super" ? makeToken(cfg.secret) : makeStaffToken(cfg.secret, who.id, who.sessionVersion), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: TTL_SECONDS,
  });
}

export async function endAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: COOKIE, path: "/admin" });
}

// --- request key and login throttling -------------------------------------------


const loginLimiter = createLimiter(5, 15 * 60 * 1000);

/**
 * Best-effort client key. x-forwarded-for is only trustworthy behind a proxy you control
 * that overwrites it; otherwise a caller can vary it to dodge the limits.
 */
export async function clientKey(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

export const loginAllowed = (key: string, now?: number) => loginLimiter.allowed(key, now);
export const recordLoginFailure = (key: string, now?: number) => loginLimiter.record(key, now);
export const clearLoginFailures = (key: string) => loginLimiter.clear(key);
