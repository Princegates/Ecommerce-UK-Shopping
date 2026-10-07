import { describe, expect, it } from "vitest";
import { decrypt, encrypt, encryptionPassphrase, maskSecret } from "./secrets";

const pass = "a-passphrase-that-is-long-enough";

describe("secrets", () => {
  it("round-trips and never repeats ciphertext", () => {
    const a = encrypt("sk_live_abc123", pass);
    const b = encrypt("sk_live_abc123", pass);
    expect(a).not.toBe(b);
    expect(a).not.toContain("sk_live");
    expect(decrypt(a, pass)).toBe("sk_live_abc123");
  });
  it("rejects tampering, the wrong key and junk", () => {
    const blob = encrypt("secret-value", pass);
    const parts = blob.split(":");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
    expect(decrypt(parts.join(":"), pass)).toBeNull();
    expect(decrypt(blob, "another-passphrase-long-enough")).toBeNull();
    expect(decrypt("nonsense", pass)).toBeNull();
  });
  it("masks without revealing the key", () => {
    expect(maskSecret("sk_live_51Habcdefghijklmnop1234")).toBe("sk_live_••••1234");
    expect(maskSecret("whsec_abcdefghijklmnop9876")).toBe("whsec_••••9876");
    expect(maskSecret("short")).toBe("••••••••");
    expect(maskSecret("abcdefghijklmnop")).toBe("••••mnop");
  });
  it("prefers a dedicated key, falls back to the admin secret, and fails closed in production", () => {
    expect(encryptionPassphrase({ SETTINGS_ENCRYPTION_KEY: "x".repeat(20), ADMIN_SECRET: "y".repeat(20), NODE_ENV: "production" } as never)).toBe("x".repeat(20));
    expect(encryptionPassphrase({ ADMIN_SECRET: "y".repeat(20), NODE_ENV: "production" } as never)).toBe("y".repeat(20));
    expect(encryptionPassphrase({ NODE_ENV: "production" } as never)).toBeNull();
    expect(encryptionPassphrase({ NODE_ENV: "development" } as never)).not.toBeNull();
  });
});
