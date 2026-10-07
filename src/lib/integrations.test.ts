import { describe, expect, it } from "vitest";
import { openForTest } from "./db";
import {
  activeMessagingProvider, activePaymentProviders, getIntegration, getChannelProviderId, isConfigured, keyMode,
  readConfig, saveFields, setChannelProvider, setEnabled, clearField,
} from "./integrations";

const env = (extra: Record<string, string> = {}) => ({ NODE_ENV: "test", ADMIN_SECRET: "a-long-enough-admin-secret", ...extra }) as unknown as NodeJS.ProcessEnv;
const stripe = getIntegration("stripe")!;
const paystack = getIntegration("paystack")!;

describe("integration config", () => {
  it("stores secrets encrypted and reads them back", () => {
    const d = openForTest();
    expect(saveFields(paystack, { secretKey: "sk_test_abcdef123456" }, d, env()).ok).toBe(true);
    const raw = d.prepare("SELECT value, is_secret FROM integration_settings WHERE provider='paystack' AND key='secretKey'").get() as { value: string; is_secret: number };
    expect(raw.is_secret).toBe(1);
    expect(raw.value).not.toContain("sk_test");
    const cfg = readConfig(paystack, d, env());
    expect(cfg.values.secretKey).toBe("sk_test_abcdef123456");
    expect(cfg.sources.secretKey).toBe("admin");
    expect(keyMode("paystack", cfg.values)).toBe("test");
  });

  it("keeps a secret when the field is left blank and lets the environment win", () => {
    const d = openForTest();
    saveFields(paystack, { secretKey: "sk_live_original0001" }, d, env());
    saveFields(paystack, { secretKey: "" }, d, env());
    expect(readConfig(paystack, d, env()).values.secretKey).toBe("sk_live_original0001");
    const locked = readConfig(paystack, d, env({ PAYSTACK_SECRET_KEY: "sk_live_fromenv00001" }));
    expect(locked.values.secretKey).toBe("sk_live_fromenv00001");
    expect(locked.sources.secretKey).toBe("env");
    saveFields(paystack, { secretKey: "sk_live_ignored00001" }, d, env({ PAYSTACK_SECRET_KEY: "sk_live_fromenv00001" }));
    expect(readConfig(paystack, d, env()).values.secretKey).toBe("sk_live_original0001");
  });

  it("flags a saved key that cannot be decrypted", () => {
    const d = openForTest();
    saveFields(paystack, { secretKey: "sk_live_original0001" }, d, env());
    const other = env({ ADMIN_SECRET: "a-completely-different-secret" });
    const cfg = readConfig(paystack, d, other);
    expect(cfg.sources.secretKey).toBe("unreadable");
    expect(isConfigured(paystack, cfg, "payments")).toBe(false);
  });

  it("refuses to save secrets when there is no encryption key in production", () => {
    const d = openForTest();
    const res = saveFields(paystack, { secretKey: "sk_live_original0001" }, d, { NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv);
    expect(res.ok).toBe(false);
  });

  it("validates choices and rejects pasted whitespace", () => {
    const d = openForTest();
    expect(saveFields(stripe, { chargeCurrency: "EUR" }, d, env()).ok).toBe(false);
    expect(saveFields(stripe, { secretKey: "sk_live_ab cd" }, d, env()).ok).toBe(false);
    expect(saveFields(stripe, { chargeCurrency: "GHS" }, d, env()).ok).toBe(true);
    expect(readConfig(stripe, d, env()).values.chargeCurrency).toBe("GHS");
  });

  it("lists only enabled, fully configured payment gateways", () => {
    const d = openForTest();
    expect(activePaymentProviders(d, env())).toHaveLength(0);
    saveFields(stripe, { secretKey: "sk_test_abcdef123456" }, d, env());
    expect(activePaymentProviders(d, env())).toHaveLength(0); // webhook secret still missing
    saveFields(stripe, { webhookSecret: "whsec_abcdef123456" }, d, env());
    expect(activePaymentProviders(d, env()).map((p) => p.def.id)).toEqual(["stripe"]);
    setEnabled(stripe, false, d);
    expect(activePaymentProviders(d, env())).toHaveLength(0);
    setEnabled(stripe, true, d);
    clearField(stripe, "webhookSecret", d);
    expect(activePaymentProviders(d, env())).toHaveLength(0);
  });

  it("selects one provider per messaging channel and needs its channel fields", () => {
    const d = openForTest();
    const twilio = getIntegration("twilio")!;
    expect(setChannelProvider("sms", "resend", d)).toBe(false);
    expect(setChannelProvider("sms", "twilio", d)).toBe(true);
    expect(getChannelProviderId("sms", d)).toBe("twilio");
    saveFields(twilio, { accountSid: "AC123", authToken: "token-value-123456", smsFrom: "+447000000000" }, d, env());
    expect(activeMessagingProvider("sms", d, env())?.def.id).toBe("twilio");
    expect(setChannelProvider("whatsapp", "twilio", d)).toBe(true);
    expect(activeMessagingProvider("whatsapp", d, env())).toBeNull(); // no WhatsApp sender yet
    expect(setChannelProvider("sms", "", d)).toBe(true);
    expect(activeMessagingProvider("sms", d, env())).toBeNull();
  });
});
