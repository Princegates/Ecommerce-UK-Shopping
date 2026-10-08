import { describe, expect, it } from "vitest";
import { LANDING, PERMISSION_KEYS, PERMISSIONS, ROLES, landingPage, normalizePermissions, presetFor, type Permission } from "./permissions";

describe("permissions", () => {
  it("never offers a right to manage staff accounts", () => {
    expect(PERMISSION_KEYS.some((k) => k.startsWith("users"))).toBe(false);
    expect(normalizePermissions(["users.manage", "orders.view"])).toEqual(["orders.view"]);
  });

  it("drops unknown rights and gives the matching view right with any change right", () => {
    expect(normalizePermissions(["nonsense", 5, null, "orders.manage"])).toEqual(["orders.view", "orders.manage"]);
    expect(normalizePermissions(["orders.confirm_payment"])).toEqual(["orders.view", "orders.confirm_payment"]);
    expect(normalizePermissions(["customers.manage"])).toEqual(["customers.view", "customers.manage"]);
    expect(normalizePermissions(["messages.manage"])).toEqual(["messages.view", "messages.manage"]);
    expect(normalizePermissions("orders.view")).toEqual([]);
    expect(normalizePermissions(undefined)).toEqual([]);
  });

  it("keeps every role made only of real rights, and the manager has them all", () => {
    for (const r of ROLES) for (const p of r.permissions) expect(PERMISSION_KEYS).toContain(p);
    expect(presetFor("manager")).toEqual(PERMISSION_KEYS);
    expect(presetFor("custom")).toEqual([]);
  });

  it("keeps the dangerous rights out of the everyday roles", () => {
    for (const key of ["operations", "support", "catalogue", "finance", "viewer"] as const) {
      expect(presetFor(key)).not.toContain("integrations.manage");
      expect(presetFor(key)).not.toContain("pricing.manage");
    }
    for (const key of ["operations", "support", "catalogue", "finance", "viewer"] as const) expect(presetFor(key)).not.toContain("orders.confirm_payment");
    expect(presetFor("support")).not.toContain("orders.manage");
    expect(presetFor("finance")).not.toContain("orders.manage");
    expect(presetFor("viewer").filter((p) => p.endsWith(".manage"))).toEqual([]);
  });

  it("has a label and help for every right, and sends people to the first page they may open", () => {
    for (const p of PERMISSIONS) expect(p.label && p.help && p.group).toBeTruthy();
    expect(landingPage(new Set<Permission>(["dashboard.view"]))).toBe("/admin");
    expect(landingPage(new Set<Permission>(["items.manage"]))).toBe("/admin/items");
    expect(landingPage(new Set<Permission>(["audit.view"]))).toBe("/admin/audit");
    expect(landingPage(new Set<Permission>())).toBe("/admin/account");
    for (const [p] of LANDING) expect(PERMISSION_KEYS).toContain(p);
  });
});
