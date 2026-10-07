import { beforeEach, describe, expect, it } from "vitest";
import { openForTest } from "../db";
import { listShops } from "../catalog";
import { importLinks, lookupLink, previewSource, publishItem, rejectItem, runDueSources, runSource, sanityProblem, sweepStale, type IngestDeps } from "./run";
import { resetHostClock, type Fetcher, type HttpResponse } from "./net";
import { getSource, listImportItems, listRuns, reviewCount, saveSource, setSourceEnabled, findListedProductByUrl, type SourceInput } from "./store";

const res = (status: number, body = ""): HttpResponse => ({ status, headers: {}, body: Buffer.from(body), truncated: false });
type Routes = Record<string, string | HttpResponse | (() => string | HttpResponse)>;

function fake(routes: Routes, log: string[] = []): { deps: IngestDeps; log: string[]; routes: Routes } {
  const fetcher: Fetcher = async (u) => {
    const key = u.toString();
    log.push(key);
    const hit = routes[key];
    if (hit === undefined) return res(404);
    const v = typeof hit === "function" ? hit() : hit;
    return typeof v === "string" ? res(200, v) : v;
  };
  return { deps: { fetcher, sleep: async () => {}, now: () => Date.parse("2026-10-07T12:00:00Z"), appUrl: "https://my.site" }, log, routes };
}

const FEED = "https://feeds.example/north.csv";
const csv = (rows: string[]) => ["id,name,price,rrp,currency,url,image,in_stock,brand", ...rows].join("\n");
const row = (id: string, name: string, price: string, extra: { rrp?: string; stock?: string; cur?: string } = {}) =>
  `${id},${name},${price},${extra.rrp ?? ""},${extra.cur ?? "GBP"},https://north.example/p/${id},https://img.example/${id}.jpg,${extra.stock ?? "1"},Northgate`;

function setup(over: Partial<SourceInput> = {}) {
  const d = openForTest();
  const shop = listShops({}, d)[0];
  const r = saveSource(
    {
      id: 0, shopId: shop.id, name: "Northgate feed", kind: "feed_csv", url: FEED, fieldMap: {}, termsUrl: "https://north.example/terms", termsNote: "Affiliate licence",
      confirmTerms: true, enabled: true, autoPublishNew: true, autoApplyUpdates: true, maxPriceChangePct: 40, maxItems: 50, delayMs: 2000, intervalHours: 24,
      staleDays: 14, defaultCategory: "", defaultWeightGrams: 600, ...over,
    },
    d,
  );
  if (!r.ok) throw new Error(r.error);
  return { d, id: r.id, shop };
}

const products = (d: ReturnType<typeof openForTest>, shopId: number, name: string) =>
  d.prepare("SELECT * FROM products WHERE shop_id = ? AND name = ?").all(shopId, name) as { id: number; price_minor: number; active: number; compare_at_minor: number | null; weight_grams: number; source_url: string; last_synced_at: string | null }[];

beforeEach(() => resetHostClock());

describe("governance", () => {
  it("will not run, or switch on, a source whose terms have not been confirmed", async () => {
    const { d, shop } = setup({ confirmTerms: false, enabled: false });
    const id = (d.prepare("SELECT id FROM catalog_sources ORDER BY id DESC LIMIT 1").get() as { id: number }).id;
    const f = fake({ [FEED]: csv([row("1", "Hat", "10.00")]) });
    const r = await runSource(id, f.deps, d);
    expect(r.status).toBe("SKIPPED");
    expect(f.log).toEqual([]);
    expect(setSourceEnabled(id, true, d)).toMatchObject({ ok: false });
    const bad = saveSource({ id: 0, shopId: shop.id, name: "x", kind: "feed_csv", url: FEED, fieldMap: {}, termsUrl: "", termsNote: "", confirmTerms: false, enabled: true, autoPublishNew: true, autoApplyUpdates: true, maxPriceChangePct: 40, maxItems: 50, delayMs: 2000, intervalHours: 24, staleDays: 14, defaultCategory: "", defaultWeightGrams: 500 }, d);
    expect(bad).toMatchObject({ ok: false });
  });

  it("rejects unsafe feed addresses and stores the address encrypted", () => {
    const { d, shop, id } = setup({ url: "https://feeds.example/f.csv?key=SECRET123" });
    const raw = d.prepare("SELECT url FROM catalog_sources WHERE id = ?").get(id) as { url: string };
    expect(raw.url.startsWith("v1:")).toBe(true);
    expect(raw.url).not.toContain("SECRET123");
    expect(getSource(id, d)!.urlDisplay).toBe("https://feeds.example/f.csv?…");
    expect(saveSource({ id: 0, shopId: shop.id, name: "x", kind: "feed_csv", url: "http://127.0.0.1/f.csv", fieldMap: {}, termsUrl: "", termsNote: "", confirmTerms: true, enabled: false, autoPublishNew: true, autoApplyUpdates: true, maxPriceChangePct: 40, maxItems: 50, delayMs: 2000, intervalHours: 24, staleDays: 14, defaultCategory: "", defaultWeightGrams: 500 }, d)).toMatchObject({ ok: false });
  });
});

describe("feed runs", () => {
  it("publishes new items automatically with price, was-price, weight and source link", async () => {
    const { d, id, shop } = setup();
    const f = fake({ [FEED]: csv([row("1", "Cloud Runner", "64.99", { rrp: "80.00" }), row("2", "Slim Jeans", "34.00"), row("3", "Euro Item", "9.00", { cur: "EUR" })]) });
    const r = await runSource(id, f.deps, d);
    expect(r).toMatchObject({ status: "OK", fetched: 2, created: 2, skipped: 1 });
    expect(r.message).toContain("price is in EUR");
    const p = products(d, shop.id, "Cloud Runner")[0];
    expect(p).toMatchObject({ price_minor: 6499, compare_at_minor: 8000, active: 1, weight_grams: 600, source_url: "https://north.example/p/1" });
    expect(p.last_synced_at).toBeTruthy();
    expect(reviewCount(d)).toBe(0);
    expect(listRuns(id, 5, d)[0]).toMatchObject({ status: "OK", created: 2 });
    expect(getSource(id, d)).toMatchObject({ lastStatus: "OK", runningSince: null });
  });

  it("applies small price changes by itself and holds big ones for review", async () => {
    const { d, id, shop } = setup();
    const routes: Routes = { [FEED]: csv([row("1", "Cloud Runner", "100.00"), row("2", "Slim Jeans", "50.00")]) };
    const f = fake(routes);
    await runSource(id, f.deps, d);
    resetHostClock();
    routes[FEED] = csv([row("1", "Cloud Runner", "110.00"), row("2", "Slim Jeans", "10.00")]);
    const r = await runSource(id, f.deps, d);
    expect(r).toMatchObject({ updated: 1, held: 1 });
    expect(products(d, shop.id, "Cloud Runner")[0].price_minor).toBe(11000);
    expect(products(d, shop.id, "Slim Jeans")[0].price_minor).toBe(5000); // unchanged until approved
    const held = listImportItems({ status: "HELD" }, d).items[0];
    expect(held.holdReason).toContain("moved 80%");
    expect(reviewCount(d)).toBe(1);
    expect(publishItem(held.id, d)).toMatchObject({ ok: true });
    expect(products(d, shop.id, "Slim Jeans")[0].price_minor).toBe(1000);
    expect(listImportItems({ status: "HELD" }, d).total).toBe(0);
  });

  it("leaves an unchanged feed alone and refreshes the checked time", async () => {
    const { d, id, shop } = setup();
    const f = fake({ [FEED]: csv([row("1", "Cloud Runner", "20.00")]) });
    await runSource(id, f.deps, d);
    resetHostClock();
    const later: IngestDeps = { ...f.deps, now: () => Date.parse("2026-10-08T12:00:00Z") };
    const r = await runSource(id, later, d);
    expect(r).toMatchObject({ created: 0, updated: 0, held: 0 });
    expect(products(d, shop.id, "Cloud Runner")[0].last_synced_at).toBe("2026-10-08 12:00:00");
  });

  it("hides items that leave the feed, brings them back when they return, and refuses to prune from a shrunken feed", async () => {
    const { d, id, shop } = setup();
    const all = [row("1", "A one", "10.00"), row("2", "B two", "10.00"), row("3", "C three", "10.00"), row("4", "D four", "10.00")];
    const routes: Routes = { [FEED]: csv(all) };
    const f = fake(routes);
    await runSource(id, f.deps, d);
    resetHostClock();
    routes[FEED] = csv([all[0], all[1], all[2]]);
    const r = await runSource(id, f.deps, d);
    expect(r.removed).toBe(1);
    expect(products(d, shop.id, "D four")[0].active).toBe(0);
    resetHostClock();
    routes[FEED] = csv(all);
    await runSource(id, f.deps, d);
    expect(products(d, shop.id, "D four")[0].active).toBe(1);
    resetHostClock();
    routes[FEED] = csv([all[0]]); // a truncated feed
    const r3 = await runSource(id, f.deps, d);
    expect(r3.removed).toBe(0);
    expect(r3.message).toContain("nothing was removed");
    expect(products(d, shop.id, "B two")[0].active).toBe(1);
  });

  it("hides out-of-stock items and restores them", async () => {
    const { d, id, shop } = setup();
    const routes: Routes = { [FEED]: csv([row("1", "Cloud Runner", "20.00")]) };
    const f = fake(routes);
    await runSource(id, f.deps, d);
    resetHostClock();
    routes[FEED] = csv([row("1", "Cloud Runner", "20.00", { stock: "out of stock" })]);
    await runSource(id, f.deps, d);
    expect(products(d, shop.id, "Cloud Runner")[0].active).toBe(0);
    resetHostClock();
    routes[FEED] = csv([row("1", "Cloud Runner", "20.00")]);
    await runSource(id, f.deps, d);
    expect(products(d, shop.id, "Cloud Runner")[0].active).toBe(1);
  });

  it("does not undo an admin's decision to hide a product when nothing about stock changed", async () => {
    const { d, id, shop } = setup();
    const routes: Routes = { [FEED]: csv([row("1", "Cloud Runner", "20.00")]) };
    const f = fake(routes);
    await runSource(id, f.deps, d);
    d.prepare("UPDATE products SET active = 0 WHERE shop_id = ? AND name = 'Cloud Runner'").run(shop.id);
    resetHostClock();
    routes[FEED] = csv([row("1", "Cloud Runner", "21.00")]);
    await runSource(id, f.deps, d);
    const p = products(d, shop.id, "Cloud Runner")[0];
    expect(p.price_minor).toBe(2100);
    expect(p.active).toBe(0);
  });

  it("keeps items for review when auto-publish is off, and publishes on approval", async () => {
    const { d, id, shop } = setup({ autoPublishNew: false });
    const f = fake({ [FEED]: csv([row("1", "Cloud Runner", "20.00")]) });
    await runSource(id, f.deps, d);
    expect(products(d, shop.id, "Cloud Runner")).toHaveLength(0);
    const item = listImportItems({ status: "PENDING" }, d).items[0];
    expect(publishItem(item.id, d)).toMatchObject({ ok: true });
    expect(products(d, shop.id, "Cloud Runner")).toHaveLength(1);
  });

  it("sends implausible prices to review even with auto-publish on, and honours rejection", async () => {
    const { d, id, shop } = setup();
    const routes: Routes = { [FEED]: csv([row("1", "Cheap thing", "0.10"), row("2", "Real thing", "20.00")]) };
    const f = fake(routes);
    await runSource(id, f.deps, d);
    expect(products(d, shop.id, "Cheap thing")).toHaveLength(0);
    const cheap = listImportItems({ status: "PENDING" }, d).items[0];
    expect(cheap.holdReason).toContain("too low");
    expect(rejectItem(cheap.id, d)).toBe(true);
    resetHostClock();
    await runSource(id, f.deps, d);
    expect(listImportItems({ status: "REJECTED" }, d).total).toBe(1);
    expect(products(d, shop.id, "Cheap thing")).toHaveLength(0);
    expect(sanityProblem({ name: "x".repeat(5), productUrl: "https://a", priceMinor: 99_999_999 } as never)).toContain("too high");
  });

  it("holds every update when auto-apply is off", async () => {
    const { d, id, shop } = setup({ autoApplyUpdates: false });
    const routes: Routes = { [FEED]: csv([row("1", "Cloud Runner", "20.00")]) };
    const f = fake(routes);
    await runSource(id, f.deps, d);
    resetHostClock();
    routes[FEED] = csv([row("1", "Cloud Runner", "21.00")]);
    expect(await runSource(id, f.deps, d)).toMatchObject({ held: 1, updated: 0 });
    expect(products(d, shop.id, "Cloud Runner")[0].price_minor).toBe(2000);
  });

  it("recreates a product that was deleted by hand", async () => {
    const { d, id, shop } = setup();
    const f = fake({ [FEED]: csv([row("1", "Cloud Runner", "20.00")]) });
    await runSource(id, f.deps, d);
    d.prepare("DELETE FROM products WHERE shop_id = ? AND name = 'Cloud Runner'").run(shop.id);
    resetHostClock();
    // fingerprint is unchanged, but the product is gone
    await runSource(id, f.deps, d);
    expect(products(d, shop.id, "Cloud Runner")).toHaveLength(1);
  });

  it("reports a feed it cannot read, and a feed that blocks us", async () => {
    const a = setup();
    expect((await runSource(a.id, fake({ [FEED]: "<html>not a feed</html>" }).deps, a.d)).status).toBe("ERROR");
    const b = setup();
    const r = await runSource(b.id, fake({ [FEED]: res(403) }).deps, b.d);
    expect(r.status).toBe("BLOCKED");
    expect(r.message).toContain("does not work around blocks");
  });

  it("reads a gzip-compressed feed, which is how big affiliate feeds are delivered", async () => {
    const { d, id, shop } = setup();
    const { gzipSync } = await import("node:zlib");
    const f = fake({ [FEED]: { status: 200, headers: {}, body: gzipSync(Buffer.from(csv([row("1", "Gzip Hat", "12.00"), row("2", "Gzip Scarf", "9.00")]))), truncated: false } });
    expect(await runSource(id, f.deps, d)).toMatchObject({ status: "OK", created: 2 });
    expect(products(d, shop.id, "Gzip Hat")).toHaveLength(1);
  });

  it("applies an explicit field map", async () => {
    const { d, id, shop } = setup({ fieldMap: { id: "ref", name: "label", price: "cost", url: "page" } });
    const f = fake({ [FEED]: "ref,label,cost,page\nK1,Kettle,25.00,https://north.example/kettle\n" });
    await runSource(id, f.deps, d);
    expect(products(d, shop.id, "Kettle")[0].price_minor).toBe(2500);
  });
});

const SITEMAP = "https://crawl.example/sitemap.xml";
const page = (name: string, price: number) =>
  `<html><script type="application/ld+json">${JSON.stringify({ "@type": "Product", name, image: "/i.jpg", offers: { "@type": "Offer", price, priceCurrency: "GBP", availability: "InStock" } })}</script></html>`;

describe("website crawling", () => {
  const sitemapSetup = (over: Partial<SourceInput> = {}) => setup({ kind: "sitemap", url: SITEMAP, ...over });

  it("reads product pages politely and respects robots.txt", async () => {
    const { d, id, shop } = sitemapSetup();
    const f = fake({
      "https://crawl.example/robots.txt": "User-agent: *\nDisallow: /basket\nCrawl-delay: 4\n",
      [SITEMAP]: `<urlset><url><loc>https://crawl.example/p/lamp</loc></url><url><loc>https://crawl.example/basket/x</loc></url><url><loc>https://other.example/p/z</loc></url></urlset>`,
      "https://crawl.example/p/lamp": page("Desk Lamp", 29),
    });
    const sleeps: number[] = [];
    f.deps.sleep = async (ms) => { sleeps.push(ms); };
    const r = await runSource(id, f.deps, d);
    expect(r).toMatchObject({ status: "OK", fetched: 1, created: 1, skipped: 1 });
    expect(r.message).toContain("disallowed by robots.txt");
    expect(f.log).not.toContain("https://crawl.example/basket/x");
    expect(f.log).not.toContain("https://other.example/p/z");
    expect(products(d, shop.id, "Desk Lamp")[0].price_minor).toBe(2900);
    expect(Math.max(...sleeps)).toBeGreaterThanOrEqual(4000);
  });

  it("stops at the first refusal, pauses the source, and does not retry until switched back on", async () => {
    const { d, id } = sitemapSetup();
    const f = fake({
      [SITEMAP]: `<urlset><url><loc>https://crawl.example/p/1</loc></url><url><loc>https://crawl.example/p/2</loc></url><url><loc>https://crawl.example/p/3</loc></url></urlset>`,
      "https://crawl.example/p/1": page("One", 10),
      "https://crawl.example/p/2": res(429),
      "https://crawl.example/p/3": page("Three", 10),
    });
    const r = await runSource(id, f.deps, d);
    expect(r.status).toBe("BLOCKED");
    expect(f.log).not.toContain("https://crawl.example/p/3");
    expect(getSource(id, d)!.pausedUntil).toBe("2026-10-08 12:00:00");
    const before = f.log.length;
    expect((await runSource(id, f.deps, d)).status).toBe("SKIPPED");
    expect(f.log.length).toBe(before);
    expect(setSourceEnabled(id, true, d)).toMatchObject({ ok: true });
    expect(getSource(id, d)!.pausedUntil).toBeNull();
  });

  it("treats a missing robots.txt as allowed but an unreachable one as a no", async () => {
    const a = sitemapSetup();
    const ok = fake({ [SITEMAP]: `<urlset><url><loc>https://crawl.example/p/1</loc></url></urlset>`, "https://crawl.example/p/1": page("One", 10) });
    expect(await runSource(a.id, ok.deps, a.d)).toMatchObject({ created: 1 });
    resetHostClock();
    const b = sitemapSetup();
    const down = fake({ "https://crawl.example/robots.txt": res(503), [SITEMAP]: `<urlset><url><loc>https://crawl.example/p/1</loc></url></urlset>`, "https://crawl.example/p/1": page("One", 10) });
    expect(await runSource(b.id, down.deps, b.d)).toMatchObject({ created: 0, skipped: 1 });
  });

  it("follows sitemap indexes, applies include filters and caps pages per run, newest first", async () => {
    const { d, id } = sitemapSetup({ maxItems: 2, fieldMap: { include: "/product/" } });
    const routes: Routes = {
      [SITEMAP]: `<sitemapindex><sitemap><loc>https://crawl.example/s1.xml</loc></sitemap></sitemapindex>`,
      "https://crawl.example/s1.xml": `<urlset>${["a", "b", "c"].map((x) => `<url><loc>https://crawl.example/product/${x}</loc></url>`).join("")}<url><loc>https://crawl.example/blog/x</loc></url></urlset>`,
    };
    for (const x of ["a", "b", "c"]) routes[`https://crawl.example/product/${x}`] = page(`Item ${x}`, 10);
    const f = fake(routes);
    await runSource(id, f.deps, d);
    expect(f.log.filter((u) => u.includes("/product/"))).toHaveLength(2);
    resetHostClock();
    f.log.length = 0;
    await runSource(id, f.deps, d); // takes the one not yet seen first
    expect(f.log.filter((u) => u.includes("/product/c"))).toHaveLength(1);
    expect(listImportItems({}, d).total).toBe(3);
  });

  it("hides a product whose page has gone", async () => {
    const { d, id, shop } = sitemapSetup();
    const routes: Routes = { [SITEMAP]: `<urlset><url><loc>https://crawl.example/p/1</loc></url></urlset>`, "https://crawl.example/p/1": page("One", 10) };
    const f = fake(routes);
    await runSource(id, f.deps, d);
    resetHostClock();
    routes["https://crawl.example/p/1"] = res(404);
    expect(await runSource(id, f.deps, d)).toMatchObject({ removed: 1 });
    expect(products(d, shop.id, "One")[0].active).toBe(0);
  });

  it("previews a source without saving anything", async () => {
    const d = openForTest();
    const f = fake({ [FEED]: csv([row("1", "Cloud Runner", "20.00"), row("2", "Hat", "x")]) });
    const p = await previewSource({ kind: "feed_csv", url: FEED, fieldMap: {} }, f.deps);
    expect(p).toMatchObject({ ok: true, totalRows: 1 });
    expect(p.sample[0].name).toBe("Cloud Runner");
    expect(p.skipNote).toContain("no valid price");
    expect(listImportItems({}, d).total).toBe(0);
    expect((await previewSource({ kind: "feed_csv", url: "http://10.0.0.1/x", fieldMap: {} }, f.deps)).ok).toBe(false);
  });
});

describe("pasted links", () => {
  const A = "https://link.example/p/mug";
  it("adds items live, re-checks them, and respects robots and blocks", async () => {
    const d = openForTest();
    const shop = listShops({}, d)[0];
    const routes: Routes = {
      "https://link.example/robots.txt": "User-agent: *\nDisallow: /private\n",
      [A]: page("Mug", 8),
      "https://link.example/private/x": page("Secret", 8),
      "https://link.example/nodata": "<html>hi</html>",
      "https://link.example/usd": `<script type="application/ld+json">{"@type":"Product","name":"US","offers":{"price":5,"priceCurrency":"USD"}}</script>`,
      "https://link.example/blocked": res(403),
    };
    const f = fake(routes);
    const out = await importLinks([A, "https://link.example/private/x", "https://link.example/nodata", "https://link.example/usd", "https://link.example/blocked", "http://127.0.0.1/x", A], { shopId: shop.id }, f.deps, d);
    expect(out.map((o) => o.status)).toEqual(["added", "robots", "no-data", "wrong-currency", "blocked", "unsafe"]);
    expect(out[0]).toMatchObject({ name: "Mug", priceMinor: 800, message: "Live on the site." });
    expect(products(d, shop.id, "Mug")).toHaveLength(1);
    expect(f.log).not.toContain("https://link.example/private/x");

    resetHostClock();
    routes[A] = page("Mug", 9);
    const again = await importLinks([A], { shopId: shop.id }, f.deps, d);
    expect(again[0].status).toBe("updated");
    expect(products(d, shop.id, "Mug")[0].price_minor).toBe(900);
    expect(findListedProductByUrl(A, d)).toMatchObject({ name: "Mug" });

    // the links source is refreshed by scheduled runs
    resetHostClock();
    routes[A] = page("Mug", 9.5);
    const due = await runDueSources({ ...f.deps, now: () => Date.parse("2026-10-09T12:00:00Z") }, d);
    expect(due.ran[0]).toMatchObject({ name: "Pasted links", status: "OK" });
    expect(products(d, shop.id, "Mug")[0].price_minor).toBe(950);
  });

  it("looks a link up for the request form without saving", async () => {
    const d = openForTest();
    const f = fake({ [A]: page("Mug", 8), "https://link.example/robots.txt": "User-agent: *\nDisallow: /private\n", "https://link.example/private/a": page("S", 1) });
    expect(await lookupLink(A, f.deps)).toMatchObject({ ok: true, item: { name: "Mug", priceMinor: 800 } });
    expect(await lookupLink("https://link.example/private/a", f.deps)).toEqual({ ok: false, reason: "robots" });
    expect(await lookupLink("http://localhost/x", f.deps)).toEqual({ ok: false, reason: "invalid" });
    expect(listImportItems({}, d).total).toBe(0);
  });
});

describe("staying fresh", () => {
  it("hides imported products not refreshed within the stale window, and restores them when seen again", async () => {
    const { d, id, shop } = setup({ staleDays: 7 });
    const routes: Routes = { [FEED]: csv([row("1", "Cloud Runner", "20.00")]) };
    const f = fake(routes);
    await runSource(id, f.deps, d);
    expect(sweepStale(d, Date.parse("2026-10-10T12:00:00Z"))).toBe(0);
    expect(sweepStale(d, Date.parse("2026-10-20T12:00:00Z"))).toBe(1);
    expect(products(d, shop.id, "Cloud Runner")[0].active).toBe(0);
    resetHostClock();
    await runSource(id, { ...f.deps, now: () => Date.parse("2026-10-21T12:00:00Z") }, d);
    expect(products(d, shop.id, "Cloud Runner")[0].active).toBe(1);
  });

  it("runs only sources that are on and due", async () => {
    const { d, id } = setup({ intervalHours: 24 });
    const f = fake({ [FEED]: csv([row("1", "Cloud Runner", "20.00")]) });
    expect((await runDueSources(f.deps, d)).ran).toHaveLength(1);
    resetHostClock();
    expect((await runDueSources({ ...f.deps, now: () => Date.parse("2026-10-07T20:00:00Z") }, d)).ran).toHaveLength(0);
    expect((await runDueSources({ ...f.deps, now: () => Date.parse("2026-10-08T13:00:00Z") }, d)).ran).toHaveLength(1);
    setSourceEnabled(id, false, d);
    resetHostClock();
    expect((await runDueSources({ ...f.deps, now: () => Date.parse("2026-10-20T13:00:00Z") }, d)).ran).toHaveLength(0);
  });
});
