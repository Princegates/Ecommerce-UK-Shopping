import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt (N=2^15, r=8, p=3), stored as
 * "scrypt$15$8$3$<salt>$<hash>" so the cost can be raised later without breaking old hashes.
 */

const LOG_N = 15;
const R = 8;
const P = 3;
const KEYLEN = 32;

function derive(password: string, salt: Buffer, logN: number, r: number, p: number): Promise<Buffer> {
  const opts: ScryptOptions = { N: 2 ** logN, r, p, maxmem: 128 * 2 ** logN * r * 2 };
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEYLEN, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, LOG_N, R, P);
  return ["scrypt", LOG_N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, logN, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const params = [Number(logN), Number(r), Number(p)];
  if (params.some((n) => !Number.isInteger(n) || n < 1) || params[0] > 20 || params[1] > 16 || params[2] > 16) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), params[0], params[1], params[2]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

let dummy: Promise<string> | undefined;

/** Spend the same time as a real check, so an unknown account cannot be told apart by how long login takes. */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummy ??= hashPassword("not-a-real-password");
  await verifyPassword(password, await dummy);
}

const COMMON = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890", "qwertyui", "qwerty123", "iloveyou",
  "11111111", "00000000", "abcd1234", "welcome1", "letmein1", "admin123", "ghana123", "accra123", "akwaaba1",
]);

/** Returns a message when the password is not acceptable, or null when it is. */
export function passwordProblem(password: string, personal: { phone?: string; email?: string; name?: string } = {}): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 128) return "Use at most 128 characters.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return "That password is too easy to guess. Try a longer phrase.";
  const digits = password.replace(/\D/g, "");
  const phoneDigits = (personal.phone ?? "").replace(/\D/g, "").slice(-9);
  if (phoneDigits.length >= 7 && digits.includes(phoneDigits)) return "Do not use your phone number as your password.";
  const local = (personal.email ?? "").split("@")[0].toLowerCase();
  if (local.length >= 4 && lower.includes(local)) return "Do not use your email address in your password.";
  return null;
}
