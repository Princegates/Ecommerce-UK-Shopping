import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$15$8$3$")).toBe(true);
    expect(h).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("correct horse batterY", h)).toBe(false);
  });
  it("salts every hash", async () => {
    expect(await hashPassword("same-password-1")).not.toBe(await hashPassword("same-password-1"));
  });
  it("treats junk and unreasonable parameters as a failed check, not a crash", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$1$2$3$a$b")).toBe(false);
    expect(await verifyPassword("x", "scrypt$99$8$3$c2FsdA$aGFzaA")).toBe(false);
  });
  it("normalises unicode so the same text always matches", async () => {
    const h = await hashPassword("café-au-lait-123");
    expect(await verifyPassword("café-au-lait-123", h)).toBe(true);
  });
}, 20_000);

describe("passwordProblem", () => {
  it("enforces length, common passwords and personal details", () => {
    expect(passwordProblem("short")).toMatch(/at least 8/);
    expect(passwordProblem("Password123")).toMatch(/too easy/);
    expect(passwordProblem("aaaaaaaaaa")).toMatch(/too easy/);
    expect(passwordProblem("0241234567x", { phone: "024 123 4567" })).toMatch(/phone/);
    expect(passwordProblem("ama.mensah-2026", { email: "ama.mensah@example.com" })).toMatch(/email/);
    expect(passwordProblem("a".repeat(129))).toMatch(/at most/);
    expect(passwordProblem("river-lamp-orange-42")).toBeNull();
  });
});
