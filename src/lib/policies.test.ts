import { describe, expect, it } from "vitest";
import { COMPANY, NOTES, POLICIES, POLICY_EFFECTIVE, policyBySlug, privacyIntro } from "./policies";

describe("the policy pack", () => {
  const all = POLICIES.flatMap((p) => p.clauses);
  const text = JSON.stringify(POLICIES);

  it("has the customer policies in order, each with unique slugs and clause numbers", () => {
    expect(POLICIES.map((p) => p.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(POLICIES.map((p) => p.slug)).size).toBe(POLICIES.length);
    expect(new Set(all.map((c) => c.n)).size).toBe(all.length);
    for (const p of POLICIES) for (const c of p.clauses) expect(c.n.startsWith(`${p.no}.`), c.n).toBe(true);
  });

  it("leaves no placeholder in the published text", () => {
    expect(text).not.toMatch(/\[[a-z][^\]]*\]/i);
    expect(text).not.toMatch(/registration no/i); // only added when the owner enters the numbers
  });

  it("does not publish the internal policies", () => {
    for (const slug of ["information-security", "partner-management", "staff-code-of-conduct"]) expect(policyBySlug(slug)).toBeUndefined();
    expect(text).not.toMatch(/Matthew Sackey|SSO or an IP allow-list|matthew\.s@/);
  });

  it("states what the website really does", () => {
    expect(text).not.toMatch(/Eversend/);
    expect(text).not.toMatch(/MFA/);
    expect(text).toContain(COMPANY.email);
    expect(POLICY_EFFECTIVE).toBe("1 November 2026");
    expect(NOTES.length).toBeGreaterThan(0);
  });

  it("names the regulators' registration numbers only when they are given", () => {
    const none = privacyIntro({ dpcRegNo: "", icoRegNo: "", email: COMPANY.email });
    expect(none.text).not.toMatch(/registered with/);
    const both = privacyIntro({ dpcRegNo: "D1", icoRegNo: "Z2", email: "a@b.co" });
    expect(both.text).toMatch(/Data Protection Commission \(Ghana\), registration no\. D1 and the Information Commissioner’s Office \(UK\), registration no\. Z2/);
    expect(both.text).toContain("a@b.co");
  });
});
