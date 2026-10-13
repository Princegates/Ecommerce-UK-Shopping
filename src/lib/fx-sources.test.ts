import { describe, expect, it, vi } from "vitest";
import { openForTest } from "./db";
import { applyMarketRate, fetchBogRate, fetchMarketRate, getFxHealth, getFxSources, getSourceErrors, parseBogRate, refreshMarketRate, saveFxPolicy } from "./fx-api";
import { bestMid, cleanSources, fxHealth, type FxSources } from "./fx-sources";
import { setExchangeRate } from "./fx";
import { getIntegration, saveFields, setChannelProvider } from "./integrations";
import { getSettings } from "./settings";
import { resetHostClock, type Fetcher, type HttpResponse } from "./ingest/net";

const env = { NODE_ENV: "test", ADMIN_SECRET: "a-long-enough-admin-secret" } as unknown as NodeJS.ProcessEnv;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const NOW = new Date("2026-10-13T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const reading = (rate: number, h = 1) => ({ rate, fetchedAt: hoursAgo(h), asOf: null });

describe("AllRatesToday", () => {
  it("asks for the pound-to-cedi pair with the key in a header, and reads a single answer", async () => {
    const f = vi.fn(async () => json({ source: "GBP", target: "GHS", rate: 15.9149, time: "2026-10-13T11:59:00Z" }));
    const r = await fetchMarketRate("allratestoday", { apiKey: "art_live_secret" }, f as never);
    expect(r).toEqual({ ok: true, rate: 15.9149, asOf: "2026-10-13T11:59:00.000Z" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://allratestoday.com/api/v1/rates?source=GBP&target=GHS");
    expect(url).not.toContain("art_live_secret");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer art_live_secret");
  });
  it("reads a list answer and reports errors without the key", async () => {
    const list = vi.fn(async () => json([{ source: "GBP", target: "GHS", rate: 15.9, time: "2026-10-13T11:59:00Z" }]));
    expect(await fetchMarketRate("allratestoday", { apiKey: "k" }, list as never)).toMatchObject({ ok: true, rate: 15.9 });
    const bad = await fetchMarketRate("allratestoday", { apiKey: "art_live_secret" }, vi.fn(async () => json({ error: "Invalid API key" }, 401)) as never);
    expect(bad).toEqual({ ok: false, error: "AllRatesToday: Invalid API key" });
  });
});

describe("Bank of Ghana page", () => {
  const page = (rows: string) => `<html><body><h1>Daily Interbank FX Rates</h1><p>Rates for 13 October 2026</p><table>
    <tr><th>Currency</th><th>Buying</th><th>Selling</th><th>Mid Rate</th></tr>${rows}</table></body></html>`;
  const usd = "<tr><td>US DOLLAR</td><td>11.7500</td><td>11.7600</td><td>11.7550</td></tr>";
  const gbp = "<tr><td>BRITISH POUND</td><td>15.9063</td><td>15.9234</td><td>15.9149</td></tr>";

  it("reads the pound's mid rate and the date", () => {
    expect(parseBogRate(page(usd + gbp))).toEqual({ ok: true, rate: 15.9149, asOf: "2026-10-13" });
  });
  it("averages buying and selling when there is no mid column, and ignores the dollar row", () => {
    const r = parseBogRate(page(usd + "<tr><td>GBP</td><td>15.90</td><td>15.92</td></tr>"));
    expect(r).toMatchObject({ ok: true, rate: 15.91 });
  });
  it("fails clearly when the pound is missing or the number is absurd", () => {
    expect(parseBogRate(page(usd))).toMatchObject({ ok: false });
    expect(parseBogRate(page("<tr><td>GBP</td><td>0.12</td><td>0.13</td><td>0.125</td></tr>"))).toMatchObject({ ok: false });
  });
  it("obeys robots.txt and stops when the site says no", async () => {
    resetHostClock();
    const res = (status: number, body: string): HttpResponse => ({ status, headers: {}, body: Buffer.from(body), truncated: false });
    const ok: Fetcher = async (u) => (u.pathname === "/robots.txt" ? res(200, "User-agent: *\nAllow: /") : res(200, page(gbp)));
    expect(await fetchBogRate({ fetcher: ok, sleep: async () => {} })).toMatchObject({ ok: true, rate: 15.9149 });
    resetHostClock();
    const disallow: Fetcher = async (u) => (u.pathname === "/robots.txt" ? res(200, "User-agent: *\nDisallow: /") : res(200, page(gbp)));
    expect(await fetchBogRate({ fetcher: disallow, sleep: async () => {} })).toMatchObject({ ok: false });
    resetHostClock();
    const blocked: Fetcher = async (u) => (u.pathname === "/robots.txt" ? res(404, "") : res(403, "no"));
    const r = await fetchBogRate({ fetcher: blocked, sleep: async () => {} });
    expect(r).toMatchObject({ ok: false });
  });
});

describe("source health", () => {
  it("is fine when sources agree, and holds quotes when they are more than the limit apart", () => {
    const agree: FxSources = { allratestoday: reading(15.9), bank_of_ghana: reading(15.95) };
    expect(fxHealth(agree, 0.015, NOW)).toMatchObject({ frozen: false });
    const apart: FxSources = { allratestoday: reading(15.9), bank_of_ghana: reading(16.3) };
    const h = fxHealth(apart, 0.015, NOW);
    expect(h.frozen).toBe(true);
    expect(h.spread).toBeCloseTo((16.3 - 15.9) / 15.9);
    expect(h.widest).toEqual({ low: "allratestoday", high: "bank_of_ghana" });
  });
  it("checks every pair, including the two mid-market feeds", () => {
    const h = fxHealth({ allratestoday: reading(15.9), openexchangerates: reading(16.2), bank_of_ghana: reading(16.0) }, 0.015, NOW);
    expect(h.frozen).toBe(true);
  });
  it("ignores a stale reading, and cannot compare with fewer than two", () => {
    expect(fxHealth({ allratestoday: reading(15.9), bank_of_ghana: reading(17, 200) }, 0.015, NOW).frozen).toBe(false);
    expect(fxHealth({ allratestoday: reading(15.9) }, 0.015, NOW)).toMatchObject({ frozen: false, spread: null });
    // the Bank of Ghana's reading lasts through a long weekend, a mid-market feed does not
    expect(fxHealth({ allratestoday: reading(15.9), bank_of_ghana: reading(15.9, 100) }, 0.015, NOW).sources.find((s) => s.id === "bank_of_ghana")?.fresh).toBe(true);
    expect(fxHealth({ allratestoday: reading(15.9, 40) }, 0.015, NOW).sources[0].fresh).toBe(false);
  });
  it("prefers AllRatesToday and falls back to the next fresh feed", () => {
    expect(bestMid({ allratestoday: reading(15.9), openexchangerates: reading(15.8) }, NOW)?.id).toBe("allratestoday");
    expect(bestMid({ allratestoday: reading(15.9, 99), openexchangerates: reading(15.8) }, NOW)?.id).toBe("openexchangerates");
    expect(bestMid({}, NOW)).toBeNull();
  });
  it("drops malformed stored readings", () => {
    expect(cleanSources({ allratestoday: { rate: "x" }, bank_of_ghana: { rate: 15.9, fetchedAt: "2026-10-13T00:00:00Z" }, nonsense: 1 })).toEqual({ bank_of_ghana: { rate: 15.9, fetchedAt: "2026-10-13T00:00:00Z", asOf: null } });
  });
});

function setup() {
  const d = openForTest();
  saveFields(getIntegration("allratestoday")!, { apiKey: "art_live_key-1234567890" }, d, env);
  saveFields(getIntegration("openexchangerates")!, { appId: "app-1234567890" }, d, env);
  setChannelProvider("rates", "allratestoday", d);
  return d;
}
const bogDeps = (rate: string): { bog: { fetcher: Fetcher; sleep: () => Promise<void> } } => {
  const res = (status: number, body: string): HttpResponse => ({ status, headers: {}, body: Buffer.from(body), truncated: false });
  return { bog: { fetcher: async (u) => (u.pathname === "/robots.txt" ? res(404, "") : res(200, `<table><tr><td>GBP</td><td>${rate}</td><td>${rate}</td><td>${rate}</td></tr></table>`)), sleep: async () => {} } };
};
/** One fetch answering for both mid-market feeds: AllRatesToday returns `a`, Open Exchange Rates cross to `b`. */
const feeds = (a: number | null, b: number) => vi.fn(async (url: string) => {
  if (String(url).includes("allratestoday")) return a === null ? json({ error: "down" }, 500) : json({ source: "GBP", target: "GHS", rate: a, time: "2026-10-13T11:59:00Z" });
  return json({ timestamp: 1_790_000_000, rates: { GBP: 1, GHS: b } });
});

describe("refreshing every source", () => {
  it("reads all three, stores each, and uses AllRatesToday as the market rate and the Bank of Ghana's for customs", async () => {
    const d = setup();
    const r = await refreshMarketRate(d, env, feeds(15.9, 15.95) as never, NOW, bogDeps("15.9149"));
    expect(r).toMatchObject({ ok: true, rate: 15.9, provider: "allratestoday" });
    const s = getFxSources(d);
    expect(Object.keys(s).sort()).toEqual(["allratestoday", "bank_of_ghana", "openexchangerates"]);
    expect(getFxHealth(d, NOW).frozen).toBe(false);
  });

  it("falls back to Open Exchange Rates when AllRatesToday is down, and says why", async () => {
    const d = setup();
    const r = await refreshMarketRate(d, env, feeds(null, 15.95) as never, NOW, bogDeps("15.93"));
    expect(r).toMatchObject({ ok: true, rate: 15.95, provider: "openexchangerates" });
    expect(getSourceErrors(d).allratestoday).toMatch(/AllRatesToday/);
  });

  it("customs uses the Bank of Ghana's rate unless an admin has set one", async () => {
    const d = setup();
    await refreshMarketRate(d, env, feeds(15.9, 15.95) as never, new Date(), bogDeps("15.93"));
    expect(getSettings(d).customsSource).toBe("bank_of_ghana");
    expect(getSettings(d).market.customs).toBe(15.93);
    const { setSetting } = await import("./settings");
    setSetting("customs_rate", 16.1, d);
    expect(getSettings(d).customsSource).toBe("manual");
    expect(getSettings(d).market.customs).toBe(16.1);
  });

  it("holds quotes and the automatic rate change when the sources disagree by more than 1.5%", async () => {
    const d = setup();
    setExchangeRate(15, 0, "", d);
    saveFxPolicy({ mode: "auto", maxChangePct: 5, alertPct: 3 }, d);
    await refreshMarketRate(d, env, feeds(15.9, 15.95) as never, new Date(), bogDeps("16.30"));
    const h = getFxHealth(d);
    expect(h.frozen).toBe(true);
    expect(applyMarketRate(d, false)).toMatchObject({ applied: false });
    expect(getSettings(d).market.mid).toBe(15);
  });

  it("with no mid-market feed it still reads the Bank of Ghana", async () => {
    const d = openForTest();
    const r = await refreshMarketRate(d, env, feeds(15.9, 15.95) as never, new Date(), bogDeps("15.93"));
    expect(r).toMatchObject({ ok: false });
    expect(getFxSources(d).bank_of_ghana?.rate).toBe(15.93);
    expect(getSettings(d).customsSource).toBe("bank_of_ghana");
  });
});
