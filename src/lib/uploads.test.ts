import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, isUploadUrl, readImage, saveImage, sniffImage, uploadDir } from "./uploads";

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(16)]);
const gif = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(32)]);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "uploads-"));

describe("uploads", () => {
  it("recognises real images by their first bytes", () => {
    expect([png, jpg, webp, gif].map(sniffImage)).toEqual(["png", "jpg", "webp", "gif"]);
    expect(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"))).toBeNull();
    expect(sniffImage(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
  });

  it("saves under a random name and reads it back with a fixed type", () => {
    const dir = tmp();
    const r = saveImage(png, dir);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isUploadUrl(r.url)).toBe(true);
    const back = readImage(r.url.replace("/uploads/", ""), dir);
    expect(back?.type).toBe("image/png");
    expect(back?.data.equals(png)).toBe(true);
    expect(saveImage(png, dir)).not.toEqual(r); // a new random name each time
  });

  it("refuses non-images, empty files and files over 4 MB", () => {
    const dir = tmp();
    expect(saveImage(Buffer.from("<svg onload=alert(1)>"), dir)).toMatchObject({ ok: false });
    expect(saveImage(Buffer.alloc(0), dir)).toMatchObject({ ok: false });
    expect(saveImage(Buffer.concat([png, Buffer.alloc(MAX_UPLOAD_BYTES)]), dir)).toMatchObject({ ok: false });
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it("will not read outside the folder or odd names", () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, "secret.txt"), "x");
    for (const n of ["../secret.txt", "..%2Fsecret.txt", "secret.txt", "a.png", "../../etc/passwd", "0".repeat(32) + ".svg", "0".repeat(32) + ".png/../x"]) {
      expect(readImage(n, dir), n).toBeNull();
    }
    expect(isUploadUrl("/uploads/../x.png")).toBe(false);
    expect(isUploadUrl("https://evil.example/a.png")).toBe(false);
  });

  it("keeps uploads beside the database", () => {
    expect(uploadDir({ DATABASE_PATH: "/data/shop.db" } as unknown as NodeJS.ProcessEnv)).toBe("/data/uploads");
    expect(uploadDir({ UPLOAD_DIR: "/x/y" } as unknown as NodeJS.ProcessEnv)).toBe("/x/y");
  });
});
