import { describe, expect, it } from "vitest";
import { makeToken, passwordMatches, verifyToken, loginAllowed, recordLoginFailure } from "./auth";

const secret = "a-test-secret-that-is-long-enough";

describe("admin token", () => {
  it("accepts a fresh token", () => {
    expect(verifyToken(makeToken(secret), secret)).toBe(true);
  });
  it("rejects a tampered, expired or foreign token", () => {
    const t = makeToken(secret);
    expect(verifyToken(t.replace(/.$/, "x"), secret)).toBe(false);
    expect(verifyToken(t, "another-secret-that-is-long-enough")).toBe(false);
    expect(verifyToken(t, secret, Date.now() + 9 * 3600 * 1000)).toBe(false);
    expect(verifyToken(undefined, secret)).toBe(false);
    expect(verifyToken("junk", secret)).toBe(false);
  });
});

describe("password and throttle", () => {
  it("compares passwords", () => {
    expect(passwordMatches("abc", "abc")).toBe(true);
    expect(passwordMatches("abc", "abd")).toBe(false);
  });
  it("blocks after five failures", () => {
    const key = "test-ip-1";
    for (let i = 0; i < 5; i++) recordLoginFailure(key);
    expect(loginAllowed(key)).toBe(false);
    expect(loginAllowed("test-ip-2")).toBe(true);
  });
});

import { makeStaffToken, verifyStaffToken } from "./auth";

describe("staff token", () => {
  it("carries the account and its session version, and rejects tampering and expiry", () => {
    const t = makeStaffToken(secret, 12, 3);
    expect(verifyStaffToken(t, secret)).toEqual({ id: 12, sessionVersion: 3 });
    expect(verifyStaffToken(t.replace(".12.", ".13."), secret)).toBeNull(); // cannot be turned into someone else's
    expect(verifyStaffToken(t.replace(".3.", ".4."), secret)).toBeNull();
    expect(verifyStaffToken(t, "another-secret-that-is-long-enough")).toBeNull();
    expect(verifyStaffToken(t, secret, Date.now() + 9 * 3600 * 1000)).toBeNull();
    expect(verifyStaffToken(undefined, secret)).toBeNull();
    expect(verifyStaffToken("junk", secret)).toBeNull();
  });

  it("keeps the super admin token and staff tokens apart", () => {
    expect(verifyToken(makeStaffToken(secret, 1, 1), secret)).toBe(false);
    expect(verifyStaffToken(makeToken(secret), secret)).toBeNull();
  });
});
