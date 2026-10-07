import { describe, expect, it } from "vitest";
import { createLimiter } from "./throttle";

describe("createLimiter", () => {
  it("blocks after max events and resets after the window", () => {
    const l = createLimiter(3, 1000);
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(l.allowed("a", t)).toBe(true);
      l.record("a", t);
    }
    expect(l.allowed("a", t)).toBe(false);
    expect(l.allowed("b", t)).toBe(true);
    expect(l.allowed("a", t + 1001)).toBe(true);
  });
  it("clear removes the count", () => {
    const l = createLimiter(1, 1000);
    l.record("a");
    expect(l.allowed("a")).toBe(false);
    l.clear("a");
    expect(l.allowed("a")).toBe(true);
  });
});
