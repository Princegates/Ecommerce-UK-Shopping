import { describe, expect, it } from "vitest";
import { canStaffTransition, staffNextStatuses } from "./order-status";

describe("order status transitions", () => {
  it("moves one step along the happy path", () => {
    expect(staffNextStatuses("PAID", "PAID")).toEqual(["PURCHASING", "CANCELLED"]);
    expect(staffNextStatuses("PURCHASED", "PAID")).toEqual(["AT_UK_WAREHOUSE"]);
  });
  it("never lets staff mark an order paid or skip ahead", () => {
    expect(canStaffTransition("AWAITING_PAYMENT", "PAID", "PENDING")).toBe(false);
    expect(canStaffTransition("PAID", "DELIVERED", "PAID")).toBe(false);
  });
  it("cannot cancel after the goods are bought", () => {
    expect(canStaffTransition("PURCHASED", "CANCELLED", "PAID")).toBe(false);
  });
  it("refunds only cancelled orders that were paid", () => {
    expect(canStaffTransition("CANCELLED", "REFUNDED", "PAID")).toBe(true);
    expect(canStaffTransition("CANCELLED", "REFUNDED", "PENDING")).toBe(false);
  });
  it("has nothing after delivery", () => {
    expect(staffNextStatuses("DELIVERED", "PAID")).toEqual([]);
  });
});
