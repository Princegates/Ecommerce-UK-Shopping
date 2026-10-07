import { describe, expect, it } from "vitest";
import { safeNext } from "./customer-session";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/checkout?zone=2")).toBe("/checkout?zone=2");
    expect(safeNext("/account/orders")).toBe("/account/orders");
  });
  it("refuses anything that could leave the site or loop", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "evil", "/login", "/register?x=1", "/a\r\nSet-Cookie: x=1", "", null, undefined]) {
      expect(safeNext(bad as never)).toBe("/account");
    }
    expect(safeNext("//evil.example", "/")).toBe("/");
  });
});
