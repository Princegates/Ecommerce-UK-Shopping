import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
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

export async function isAdmin(): Promise<boolean> {
  const cfg = adminConfig();
  if (!cfg) return false;
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE)?.value, cfg.secret);
}

/** Call at the top of every admin page and every admin server action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function startAdminSession(): Promise<void> {
  const cfg = adminConfig();
  if (!cfg) throw new Error("Admin is not configured");
  const jar = await cookies();
  jar.set(COOKIE, makeToken(cfg.secret), {
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
