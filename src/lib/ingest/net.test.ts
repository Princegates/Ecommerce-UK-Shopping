import { describe, expect, it, beforeEach } from "vitest";
import {
  BlockedError, HttpError, RobotsCache, UnsafeUrlError, assertFetchableUrl, bodyText, isPrivateAddress, parseRobots,
  politeFetch, resetHostClock, userAgent, type Fetcher, type HttpResponse,
} from "./net";
import { gzipSync } from "node:zlib";

const res = (status: number, body = "", headers: Record<string, string> = {}): HttpResponse => ({ status, headers, body: Buffer.from(body), truncated: false });

beforeEach(() => resetHostClock());

describe("address safety", () => {
  it("flags private, loopback, link-local and metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.0.1", "172.31.255.255", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd12::1", "fe80::1", "::ffff:10.0.0.1", "224.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "151.101.1.1", "172.32.0.1", "2606:4700:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("rejects unsafe URLs before any request", () => {
    for (const u of ["ftp://x.com/a", "http://localhost/a", "http://127.0.0.1/a", "http://[::1]/a", "https://user:pw@example.com/", "https://example.com:8443/", "file:///etc/passwd", "not a url", "http://intranet.internal/x"]) {
      expect(() => assertFetchableUrl(u), u).toThrow(UnsafeUrlError);
    }
    expect(assertFetchableUrl("https://www.example.co.uk/p/1").host).toBe("www.example.co.uk");
  });
});

describe("robots.txt", () => {
  const txt = `
User-agent: *
Disallow: /basket
Disallow: /search?
Allow: /search?q=special
Crawl-delay: 5

User-agent: ShopCatalogBot
Disallow: /private/
Allow: /private/public$
`;
  it("prefers the group that names us", () => {
    const r = parseRobots(txt);
    expect(r.test("/basket")).toBe(true); // the named group has no rule for it
    expect(r.test("/private/x")).toBe(false);
    expect(r.test("/private/public")).toBe(true);
    expect(r.test("/private/publicity")).toBe(false);
  });
  it("falls back to * with longest-match and crawl-delay", () => {
    const r = parseRobots("User-agent: *\nDisallow: /basket\nDisallow: /search?\nAllow: /search?q=special\nCrawl-delay: 5\n");
    expect(r.delaySeconds).toBe(5);
    expect(r.test("/basket/1")).toBe(false);
    expect(r.test("/search?q=shoes")).toBe(false);
    expect(r.test("/search?q=special")).toBe(true);
    expect(r.test("/products/1")).toBe(true);
  });
  it("supports wildcards and end anchors, and an empty Disallow allows all", () => {
    const r = parseRobots("User-agent: *\nDisallow: /*.json$\nDisallow: /a/*/b\n");
    expect(r.test("/x.json")).toBe(false);
    expect(r.test("/x.json?v=1")).toBe(true);
    expect(r.test("/a/1/b")).toBe(false);
    expect(parseRobots("User-agent: *\nDisallow:\n").test("/anything")).toBe(true);
  });
  it("blocks everything when disallowed at the root", () => {
    expect(parseRobots("User-agent: *\nDisallow: /\n").test("/p/1")).toBe(false);
  });
  it("treats a missing file as allow and an unreachable or blocked file as deny", async () => {
    const missing = new RobotsCache({ fetcher: async () => res(404), sleep: async () => {} });
    expect((await missing.allowed(new URL("https://a.example/p"))).ok).toBe(true);
    const blocked = new RobotsCache({ fetcher: async () => res(403), sleep: async () => {} });
    expect((await blocked.allowed(new URL("https://b.example/p"))).ok).toBe(false);
    const down = new RobotsCache({ fetcher: async () => res(503), sleep: async () => {} });
    expect((await down.allowed(new URL("https://c.example/p"))).ok).toBe(false);
  });
  it("fetches robots.txt once per host", async () => {
    let calls = 0;
    const c = new RobotsCache({ fetcher: async () => { calls++; return res(200, "User-agent: *\nDisallow: /no"); }, sleep: async () => {} });
    expect((await c.allowed(new URL("https://d.example/yes"))).ok).toBe(true);
    expect((await c.allowed(new URL("https://d.example/no/1"))).ok).toBe(false);
    expect(calls).toBe(1);
  });
});

describe("polite fetching", () => {
  it("identifies itself honestly", async () => {
    let ua = "";
    const fetcher: Fetcher = async (_u, o) => { ua = o.userAgent; return res(200, "<html></html>"); };
    await politeFetch("https://shop.example/p", { fetcher, appUrl: "https://my.site/" });
    expect(ua).toBe("ShopCatalogBot/1.0 (+https://my.site/bot)");
    expect(userAgent(null)).toBe("ShopCatalogBot/1.0");
  });

  it("waits between requests to the same host", async () => {
    let t = 1_000_000;
    const waits: number[] = [];
    const deps = { fetcher: (async () => res(200, "ok")) as Fetcher, now: () => t, sleep: async (ms: number) => { waits.push(ms); t += ms; } };
    await politeFetch("https://slow.example/1", deps, { delayMs: 3000 });
    await politeFetch("https://slow.example/2", deps, { delayMs: 3000 });
    await politeFetch("https://other.example/1", deps, { delayMs: 3000 });
    expect(waits).toEqual([3000]);
  });

  it("stops and reports a block instead of retrying", async () => {
    for (const status of [401, 403, 429]) {
      let calls = 0;
      const fetcher: Fetcher = async () => { calls++; return res(status); };
      await expect(politeFetch("https://blocked.example/p", { fetcher })).rejects.toBeInstanceOf(BlockedError);
      expect(calls).toBe(1);
    }
  });

  it("treats a verification page as a block", async () => {
    const fetcher: Fetcher = async () => res(200, "<html><title>Just a moment...</title><div id='cf-chl-widget'></div></html>");
    await expect(politeFetch("https://cf.example/p", { fetcher })).rejects.toBeInstanceOf(BlockedError);
  });

  it("does not mistake a real product page that mentions captcha for a block", async () => {
    const html = `<html><script type="application/ld+json">{"@type":"Product"}</script>captcha</html>`;
    const fetcher: Fetcher = async () => res(200, html);
    await expect(politeFetch("https://ok.example/p", { fetcher })).resolves.toBeTruthy();
  });

  it("reports ordinary errors as HttpError", async () => {
    await expect(politeFetch("https://gone.example/p", { fetcher: async () => res(404) })).rejects.toMatchObject({ status: 404, name: "HttpError" });
    await expect(politeFetch("https://gone.example/p", { fetcher: async () => res(500) })).rejects.toBeInstanceOf(HttpError);
  });

  it("follows a few redirects and re-checks each address", async () => {
    const seen: string[] = [];
    const fetcher: Fetcher = async (u) => {
      seen.push(u.toString());
      if (u.pathname === "/a") return res(301, "", { location: "/b" });
      if (u.pathname === "/b") return res(302, "", { location: "http://127.0.0.1/secret" });
      return res(200, "x");
    };
    await expect(politeFetch("https://r.example/a", { fetcher })).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(seen).toEqual(["https://r.example/a", "https://r.example/b"]);
    const loop: Fetcher = async () => res(301, "", { location: "/again" });
    await expect(politeFetch("https://loop.example/a", { fetcher: loop })).rejects.toBeInstanceOf(HttpError);
  });
});

describe("bodyText", () => {
  it("unzips gzipped sitemaps", () => {
    const r: HttpResponse = { status: 200, headers: {}, body: gzipSync(Buffer.from("<urlset></urlset>")), truncated: false };
    expect(bodyText(r)).toBe("<urlset></urlset>");
  });
});

describe("real transport", () => {
  it("refuses a hostname that resolves to an internal address (checked at connect time)", async () => {
    const { nodeFetcher } = await import("./net");
    const opts = { userAgent: "t", accept: "*/*", maxBytes: 1000, timeoutMs: 3000 };
    // "localhost" passes no literal-address check here because we call the transport directly
    await expect(nodeFetcher(new URL("http://localhost/"), opts)).rejects.toThrow(/public internet/);
  });
});
