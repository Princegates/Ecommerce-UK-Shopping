import { describe, expect, it } from "vitest";
import { isEmail, toE164 } from "./phone";

describe("toE164", () => {
  it("handles every way a Ghana number gets typed", () => {
    for (const v of ["024 123 4567", "0241234567", "+233 24 123 4567", "233241234567", "00233241234567", "241234567"]) {
      expect(toE164(v)).toBe("+233241234567");
    }
  });
  it("keeps other countries, such as UK numbers", () => {
    expect(toE164("+44 7700 900123")).toBe("+447700900123");
    expect(toE164("0044 7700 900123")).toBe("+447700900123");
  });
  it("rejects things that cannot be numbers", () => {
    for (const v of ["", "abc", "123", "+233 24 123", "02412345678901234"]) expect(toE164(v)).toBeNull();
  });
});

describe("isEmail", () => {
  it("accepts plain addresses and rejects junk", () => {
    expect(isEmail("ama@example.com")).toBe(true);
    expect(isEmail("ama@example")).toBe(false);
    expect(isEmail("a b@example.com")).toBe(false);
  });
});
