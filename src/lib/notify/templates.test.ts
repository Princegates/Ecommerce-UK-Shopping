import { describe, expect, it } from "vitest";
import { renderOrderMessage, renderResetMessage } from "./templates";

const base = { siteName: "Akwaaba UK", customerName: "Ama Mensah", orderNumber: "UKG-2026-000001", totalMinor: 241847, link: "https://shop.example/order/pay_abc", status: "SHIPPED_TO_GHANA" as const };

describe("order messages", () => {
  it("keeps the SMS short and includes the tracking link", () => {
    const m = renderOrderMessage(base);
    expect(m.sms).toContain("UKG-2026-000001");
    expect(m.sms).toContain("https://shop.example/order/pay_abc");
    expect(m.sms.length).toBeLessThan(160);
  });
  it("states the amount received on payment", () => {
    expect(renderOrderMessage({ ...base, status: "PAID" }).sms).toContain("GH₵2,418.47");
  });
  it("escapes customer-controlled text in the HTML email", () => {
    const m = renderOrderMessage({ ...base, customerName: '<img src=x onerror=alert(1)> "Bob"', siteName: "A&B <Shop>" });
    expect(m.email.html).not.toContain("<img");
    expect(m.email.html).toContain("&lt;img");
    expect(m.email.html).toContain("A&amp;B &lt;Shop&gt;");
  });
  it("gives WhatsApp templates single-line variables", () => {
    const m = renderOrderMessage(base);
    expect(m.vars).toMatchObject({ name: "Ama", orderNumber: "UKG-2026-000001" });
    expect(m.vars.update).not.toMatch(/[\r\n]/);
  });
  it("renders a reset message with the link", () => {
    const m = renderResetMessage("Akwaaba UK", "https://shop.example/reset-password/tok", 60);
    expect(m.sms).toContain("https://shop.example/reset-password/tok");
    expect(m.email.text).toContain("valid for 60 minutes");
  });
});
