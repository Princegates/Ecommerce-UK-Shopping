import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Encryption for API keys stored in the database (AES-256-GCM).
 * The key comes from SETTINGS_ENCRYPTION_KEY, or from ADMIN_SECRET when that is not set.
 * Use a dedicated SETTINGS_ENCRYPTION_KEY so rotating the admin session secret does not
 * make saved keys unreadable.
 */

const SALT = "ukgh-shop/integration-settings/v1";

export function encryptionPassphrase(env: NodeJS.ProcessEnv = process.env): string | null {
  const dedicated = env.SETTINGS_ENCRYPTION_KEY;
  if (dedicated && dedicated.length >= 16) return dedicated;
  const admin = env.ADMIN_SECRET;
  if (admin && admin.length >= 16) return admin;
  if (env.NODE_ENV !== "production") return "dev-only-secret-change-me-0000";
  return null;
}

const keyCache = new Map<string, Buffer>();
function key(passphrase: string): Buffer {
  let k = keyCache.get(passphrase);
  if (!k) {
    k = scryptSync(passphrase, SALT, 32);
    if (keyCache.size > 8) keyCache.clear();
    keyCache.set(passphrase, k);
  }
  return k;
}

export function encrypt(plain: string, passphrase: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(passphrase), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(":");
}

/** Returns null when the value is malformed, tampered with, or was encrypted with another key. */
export function decrypt(blob: string, passphrase: string): string | null {
  const parts = blob.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(passphrase), Buffer.from(parts[1], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Shows enough of a key to recognise it without revealing it: "sk_live_…a1b2". */
export function maskSecret(value: string): string {
  if (value.length <= 8) return "••••••••";
  const prefix = /^[A-Za-z]{2,10}_(?:live_|test_)?/.exec(value)?.[0] ?? /^FLWSECK[_-](?:TEST-)?/.exec(value)?.[0] ?? "";
  return `${prefix}••••${value.slice(-4)}`;
}
