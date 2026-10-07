import { describe, expect, it, vi } from "vitest";
import { openForTest } from "./db";
import { actionQueue } from "./analytics";
import { applyMarketRate, drift, fetchMarketRate, getFxPolicy, getMarketRate, refreshMarketRate, saveFxPolicy, syncRates, testRateProvider } from "./fx-api";
import { setExchangeRate } from "./fx";
import { getIntegration, saveFields, setChannelProvider } from "./integrations";
import { getSettings } from "./settings";

const env = { NODE_ENV: "test", ADMIN_SECRET: "a-long-enough-admin-secret" } as unknown as NodeJS.ProcessEnv;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

function withProvider(id: "exchangerate_api" | "openexchangerates" = "exchangerate_api") {
  const d = openForTest();
  saveFields(getIntegration(id)!, id === "exchangerate_api" ? { apiKey: "key-1234567890" } : { appId: "app-1234567890" }, d, env);
  setChannelProvider("rates", id, d);
  return d;
}
const feed = (rate: number) => vi.fn(async () => json({ result: "success", conversion_rate: rate, time_last_update_unix: 1_790_000_000 }));

describe("fetching a market rate", () => {
  it("reads ExchangeRate-API", async () => {
    const f = feed(15.6234);
    expect(await fetchMarketRate("exchangerate_api", { apiKey: "k" }, f as never)).toEqual({ ok: true, rate: 15.6234, asOf: new Date(1_790_000_000 * 1000).toISOString() });
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe("https://v6.exchangerate-api.com/v6/k/pair/GBP/GHS");
  });
  it("crosses Open Exchange Rates' USD-based quotes and keeps the key in a header", async () => {
    const f = vi.fn(async () => json({ timestamp: 1_790_000_000, base: "USD", rates: { GBP: 0.8, GHS: 12.4 } }));
    const r = await fetchMarketRate("openexchangerates", { appId: "secret-app-id" }, f as never);
    expect(r).toMatchObject({ ok: true, rate: 15.5 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("secret-app-id");
    expect((init.headers as Record<string, string>).Authorization).toBe("Token secret-app-id");
  });
  it("reports provider errors without leaking the key or address", async () => {
    const bad = await fetchMarketRate("exchangerate_api", { apiKey: "SECRETKEY" }, vi.fn(async () => json({ result: "error", "error-type": "invalid-key" }, 403)) as never);
    expect(bad).toEqual({ ok: false, error: "ExchangeRate-API: invalid-key" });
    const down = await fetchMarketRate("exchangerate_api", { apiKey: "SECRETKEY" }, vi.fn(async () => { throw new Error("connect ECONNREFUSED https://v6.exchangerate-api.com/v6/SECRETKEY/pair"); }) as never);
    expect(JSON.stringify(down)).not.toContain("SECRETKEY");
    expect(down).toMatchObject({ ok: false });
  });
  it("rejects rates that cannot be real", async () => {
    for (const rate of [0, -3, 0.2, 5000]) expect((await fetchMarketRate("exchangerate_api", { apiKey: "k" }, feed(rate) as never)).ok).toBe(false);
  });
});

describe("refreshing and applying", () => {
  it("stores the market rate without changing what customers are quoted", async () => {
    const d = withProvider();
    setExchangeRate(15, 3, "", d);
    const r = await refreshMarketRate(d, env, feed(15.4) as never);
    expect(r).toMatchObject({ ok: true, rate: 15.4, provider: "exchangerate_api" });
    expect(getMarketRate(d)?.rate).toBe(15.4);
    expect(getSettings(d).fx.rate).toBe(15);
    expect(drift(d)).toBeCloseTo((15 - 15.4) / 15.4);
  });
  it("needs an active provider and ignores absurd jumps", async () => {
    const d = openForTest();
    expect(await refreshMarketRate(d, env, feed(15) as never)).toMatchObject({ ok: false });
    const d2 = withProvider();
    await refreshMarketRate(d2, env, feed(15) as never);
    expect(await refreshMarketRate(d2, env, feed(40) as never)).toMatchObject({ ok: false });
    expect(getMarketRate(d2)?.rate).toBe(15);
  });
  it("applies the market rate on request and keeps the admin's markup", async () => {
    const d = withProvider();
    setExchangeRate(15, 4, "", d);
    await refreshMarketRate(d, env, feed(15.8) as never);
    expect(applyMarketRate(d, true)).toMatchObject({ applied: true });
    expect(getSettings(d).fx).toEqual({ rate: 15.8, markupPct: 4 });
    expect(applyMarketRate(d, true)).toMatchObject({ applied: false }); // already in line
  });
  it("only applies automatically in auto mode and within the limit", async () => {
    const d = withProvider();
    setExchangeRate(15, 3, "", d);
    await refreshMarketRate(d, env, feed(15.3) as never);
    expect(applyMarketRate(d, false).applied).toBe(false); // default mode only suggests
    expect(saveFxPolicy({ mode: "auto", maxChangePct: 5, alertPct: 3 }, d).ok).toBe(true);
    expect(applyMarketRate(d, false).applied).toBe(true);
    expect(getSettings(d).fx.rate).toBe(15.3);
    await refreshMarketRate(d, env, feed(17) as never); // +11%
    const held = applyMarketRate(d, false);
    expect(held.applied).toBe(false);
    expect(held.reason).toContain("limit");
    expect(getSettings(d).fx.rate).toBe(15.3);
    expect(saveFxPolicy({ mode: "manual", maxChangePct: 5, alertPct: 3 }, d).ok).toBe(true);
    expect(applyMarketRate(d, false).applied).toBe(false);
  });
  it("syncRates does both steps for the scheduled job", async () => {
    const d = withProvider();
    setExchangeRate(15, 3, "", d);
    saveFxPolicy({ mode: "auto", maxChangePct: 5, alertPct: 3 }, d);
    expect(await syncRates(d, env, feed(15.2) as never)).toMatchObject({ ok: true, applied: true });
    expect(getSettings(d).fx.rate).toBe(15.2);
  });
  it("validates policy values and tests a provider without storing anything", async () => {
    const d = withProvider();
    expect(saveFxPolicy({ mode: "auto", maxChangePct: 0, alertPct: 3 }, d).ok).toBe(false);
    expect(saveFxPolicy({ mode: "nope" as never, maxChangePct: 5, alertPct: 3 }, d).ok).toBe(false);
    expect(getFxPolicy(d).mode).toBe("suggest");
    const t = await testRateProvider("exchangerate_api", d, env, feed(15.5) as never);
    expect(t.ok).toBe(true);
    expect(t.message).toContain("15.5");
    expect(getMarketRate(d)).toBeNull();
    expect((await testRateProvider("stripe" as never, d, env)).ok).toBe(false);
  });
  it("raises an alert when the quoted rate drifts from the market", async () => {
    const d = withProvider();
    setExchangeRate(15, 3, "", d);
    await refreshMarketRate(d, env, feed(15.1) as never);
    expect(actionQueue(5, d).some((q) => q.key === "fxdrift")).toBe(false);
    await refreshMarketRate(d, env, feed(16.2) as never);
    const alert = actionQueue(5, d).find((q) => q.key === "fxdrift");
    expect(alert?.tone).toBe("urgent");
    expect(alert?.label).toContain("below the market");
  });
});
