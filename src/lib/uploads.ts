import "server-only";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Product photos uploaded in the admin. They live in an "uploads" folder next to the database, so on a host with a
 * persistent disk they survive restarts. Only real JPEG, PNG, WebP and GIF files are accepted (checked by their first
 * bytes, not their name), and files are served with a fixed type so an upload can never run as a page.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
const NAME = /^[a-f0-9]{32}\.(jpg|png|webp|gif)$/;

export function uploadDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.UPLOAD_DIR) return env.UPLOAD_DIR;
  const db = env.DATABASE_PATH && env.DATABASE_PATH !== ":memory:" ? env.DATABASE_PATH : path.join(process.cwd(), "data", "shop.db");
  return path.join(path.dirname(db), "uploads");
}

/** The file type from the first bytes, or null when it is not an image we accept. */
export function sniffImage(b: Buffer): "jpg" | "png" | "webp" | "gif" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (b.length > 6 && (b.subarray(0, 6).toString("latin1") === "GIF87a" || b.subarray(0, 6).toString("latin1") === "GIF89a")) return "gif";
  return null;
}

export function saveImage(data: Buffer, dir = uploadDir()): { ok: true; url: string } | { ok: false; error: string } {
  if (data.length === 0) return { ok: false, error: "That file is empty." };
  if (data.length > MAX_UPLOAD_BYTES) return { ok: false, error: "The image is larger than 4 MB. Resize it and try again." };
  const kind = sniffImage(data);
  if (!kind) return { ok: false, error: "Upload a JPEG, PNG, WebP or GIF image." };
  fs.mkdirSync(dir, { recursive: true });
  const name = `${randomBytes(16).toString("hex")}.${kind}`;
  fs.writeFileSync(path.join(dir, name), data, { mode: 0o644 });
  return { ok: true, url: `/uploads/${name}` };
}

export function readImage(name: string, dir = uploadDir()): { data: Buffer; type: string } | null {
  if (!NAME.test(name)) return null;
  try {
    return { data: fs.readFileSync(path.join(dir, name)), type: TYPES[name.split(".")[1]] };
  } catch {
    return null;
  }
}

/** True for an address we created ourselves, so the admin form can keep it. */
export function isUploadUrl(u: string): boolean {
  return /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp|gif)$/.test(u);
}
