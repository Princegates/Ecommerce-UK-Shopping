import { describe, expect, it } from "vitest";
import { readChoice } from "./consent";

describe("cookie choice", () => {
  it("reads the choice from the cookie string", () => {
    expect(readChoice("cookie_choice=all")).toBe("all");
    expect(readChoice("sid=abc; cookie_choice=essential; cart=1")).toBe("essential");
  });
  it("is empty until the visitor chooses, and ignores anything else", () => {
    expect(readChoice("")).toBeNull();
    expect(readChoice("cart=1; sid=abc")).toBeNull();
    expect(readChoice("cookie_choice=maybe")).toBeNull();
    expect(readChoice("x_cookie_choice=all")).toBeNull();
  });
});
