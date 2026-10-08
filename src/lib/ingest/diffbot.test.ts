import { beforeEach, describe, expect, it } from "vitest";
import { openForTest } from "../db";
import { listShops } from "../catalog";
import { getIntegration, saveFields } from "../integrations";
import { diffbotProduct, mapDiffbotProduct, parseProductUrls } from "./diffbot";
import { resetHostClock, type Fetcher, type HttpResponse } from "./net";
import { previewSource, runSource, type IngestDeps } from "./run";
import { listImportItems, saveSource } from "./store";

const PAGE_A = "https://shop.example/product/kettle";
const PAGE_B = "https://shop.example/product/toaster";
const TOKEN = "dbtoken1234567890";

const object = (over: Record<string, unknown> = {}) => ({
  type: "product", title: "Acme Kettle 1.7L", pageUrl: PAGE_A, offerPrice: "£24.99", offerPriceDetails: { amount: 24.99, symbol: "£", text: "£24.99" },
  regularPrice: "£34.99", regularPriceDetails: { amount: 34.99, symbol: "£", text: "£34.99" }, availability: true, brand: "Acme",
  images: [{ url: "https://shop.example/img/small.jpg" }, { url: "https://shop.example/img/main.jpg", primary: true }], text: "A <b>fast</b> kettle.", category: "Kettles", ...over,
});

describe("parseProductUrls", () => {
  it("keeps web addresses once each, and drops everything else", () => {
    expect(parseProductUrls(`${PAGE_A}#reviews\n  \n${PAGE_A}\nnot a link\nftp://shop.example/x\njavascript:alert(1)\nhttp://shop.example/y`)).toEqual([PAGE_A, "http://shop.example/y"]);
    expect(parseProductUrls(Array.from({ length: 250 }, (_, i) => `https://shop.example/p/${i}`).join("\n"))).toHaveLength(200);
  });
});

describe("mapDiffbotProduct", () => {
  it("maps a product with its was-price, primary photo and stock", () => {
    const r = mapDiffbotProduct(object(), PAGE_A);
    expect(r).toMatchObject({
      item: {
        productUrl: PAGE_A, name: "Acme Kettle 1.7L", brand: "Acme", category: "Kettles", description: "A fast kettle.", priceMinor: 2499, compareAtMinor: 3499,
        imageUrl: "https://shop.example/img/main.jpg", inStock: true, weightGrams: null,
      },
    });
    expect("item" in r && r.item.externalId).toMatch(/^diffbot-[0-9a-f]{16}$/);
    const renamed = mapDiffbotProduct(object({ title: "Renamed" }), PAGE_A);
    expect("item" in r && "item" in renamed && r.item.externalId === renamed.item.externalId).toBe(true);
    const other = mapDiffbotProduct(object(), PAGE_B);
    expect("item" in r && "item" in other && r.item.externalId !== other.item.externalId).toBe(true);
  });

  it("reads a price given only as text, and reports sold-out pages", () => {
    const r = mapDiffbotProduct(object({ offerPriceDetails: undefined, regularPrice: undefined, regularPriceDetails: undefined, availability: false }), PAGE_A);
    expect(r).toMatchObject({ item: { priceMinor: 2499, compareAtMinor: null, inStock: false } });
  });

  it("skips what it cannot price in pounds", () => {
    expect(mapDiffbotProduct(object({ offerPrice: "$24.99", offerPriceDetails: { amount: 24.99, symbol: "$" } }), PAGE_A)).toEqual({ skip: "no price in pounds" });
    expect(mapDiffbotProduct(object({ offerPrice: "24.99", offerPriceDetails: undefined }), PAGE_A)).toEqual({ skip: "no price in pounds" });
    expect(mapDiffbotProduct(object({ offerPrice: undefined, offerPriceDetails: undefined }), PAGE_A)).toEqual({ skip: "no price in pounds" });
    expect(mapDiffbotProduct(object({ title: "" }), PAGE_A)).toEqual({ skip: "no title" });
  });
});

describe("diffbotProduct", () => {
  const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("asks for the page with the token and returns the product", async () => {
    let seen = "";
    const f = (async (u: RequestInfo | URL) => { seen = String(u); return new Response(JSON.stringify({ objects: [object()] }), { status: 200 }); }) as unknown as typeof fetch;
    const r = await diffbotProduct({ token: TOKEN }, PAGE_A, f);
    expect("object" in r && r.object.title).toBe("Acme Kettle 1.7L");
    const u = new URL(seen);
    expect(u.origin + u.pathname).toBe("https://api.diffbot.com/v3/product");
    expect(u.searchParams.get("token")).toBe(TOKEN);
    expect(u.searchParams.get("url")).toBe(PAGE_A);
  });

  it("stops the run on token, credit and rate-limit problems, without leaking the token", async () => {
    for (const [status, text] of [[401, /did not accept the token/], [402, /credits have run out/], [429, /too many requests/]] as const) {
      const err = await diffbotProduct({ token: TOKEN }, PAGE_A, reply(status, { error: "x", errorCode: status })).catch((e) => e as Error);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(text);
      expect((err as Error).message).not.toContain(TOKEN);
    }
    // Diffbot can also report these inside a 200 reply
    await expect(diffbotProduct({ token: TOKEN }, PAGE_A, reply(200, { error: "Not authorized API token", errorCode: 401 }))).rejects.toThrow(/did not accept the token/);
    await expect(diffbotProduct({ token: TOKEN }, PAGE_A, reply(503, "down"))).rejects.toThrow(/HTTP 503/);
  });

  it("only skips a page it cannot read or that has no product", async () => {
    expect(await diffbotProduct({ token: TOKEN }, PAGE_A, reply(200, { error: "Could not download page (404)", errorCode: 500 }))).toEqual({ skip: "Diffbot could not read the page" });
    expect(await diffbotProduct({ token: TOKEN }, PAGE_A, reply(200, { objects: [{ type: "article", title: "News" }] }))).toEqual({ skip: "no product found on the page" });
    expect(await diffbotProduct({ token: TOKEN }, PAGE_A, reply(200, { objects: [] }))).toEqual({ skip: "no product found on the page" });
  });
});

const res = (status: number, body = ""): HttpResponse => ({ status, headers: {}, body: Buffer.from(body), truncated: false });

function fakes(opts: { robots?: string | number; pages?: Record<string, unknown>; account?: number } = {}) {
  const diffbotCalls: string[] = [];
  const robotsCalls: string[] = [];
  const fetcher: Fetcher = async (u) => {
    const url = u.toString();
    robotsCalls.push(url);
    if (url === "https://shop.example/robots.txt") return typeof opts.robots === "number" ? res(opts.robots) : res(200, opts.robots ?? "User-agent: *\nDisallow: /cart\n");
    return res(404);
  };
  const diffbotFetch = (async (input: RequestInfo | URL) => {
    const q = new URL(String(input)).searchParams;
    const page = q.get("url") ?? "";
    diffbotCalls.push(page);
    if (opts.account) return new Response(JSON.stringify({ error: "x", errorCode: opts.account }), { status: opts.account });
    const body = (opts.pages ?? { [PAGE_A]: { objects: [object()] }, [PAGE_B]: { objects: [object({ title: "Acme Toaster", offerPrice: "£19.00", offerPriceDetails: { amount: 19, symbol: "£" }, regularPrice: undefined, regularPriceDetails: undefined })] } })[page];
    return new Response(JSON.stringify(body ?? { objects: [] }), { status: 200 });
  }) as unknown as typeof fetch;
  const deps: IngestDeps = { fetcher, diffbotFetch, sleep: async () => {}, now: () => Date.parse("2026-10-07T12:00:00Z"), appUrl: "https://my.site" };
  return { deps, diffbotCalls, robotsCalls };
}

function setup(token = true, urls = `${PAGE_A}\n${PAGE_B}`) {
  const d = openForTest();
  if (token) saveFields(getIntegration("diffbot")!, { token: TOKEN }, d);
  const shop = listShops({}, d)[0];
  const r = saveSource(
    {
      id: 0, shopId: shop.id, name: "Diffbot pages", kind: "diffbot", url: "", fieldMap: { urls }, termsUrl: "", termsNote: "Own listing pages", confirmTerms: true, enabled: true,
      autoPublishNew: true, autoApplyUpdates: true, maxPriceChangePct: 40, maxItems: 50, delayMs: 3000, intervalHours: 24, staleDays: 14, defaultCategory: "", defaultWeightGrams: 800,
    },
    d,
  );
  if (!r.ok) throw new Error(r.error);
  return { d, id: r.id, shop };
}

beforeEach(() => resetHostClock());

describe("Diffbot source", () => {
  it("publishes the pages Diffbot reads, with photo, was-price and the link back", async () => {
    const { d, id, shop } = setup();
    const f = fakes();
    const r = await runSource(id, f.deps, d);
    expect(r).toMatchObject({ status: "OK", fetched: 2, created: 2 });
    const p = d.prepare("SELECT price_minor, compare_at_minor, image_url, source_url, weight_grams, active FROM products WHERE shop_id = ? AND name = 'Acme Kettle 1.7L'").get(shop.id) as Record<string, unknown>;
    expect(p).toEqual({ price_minor: 2499, compare_at_minor: 3499, image_url: "https://shop.example/img/main.jpg", source_url: PAGE_A, weight_grams: 800, active: 1 });
    expect(f.diffbotCalls).toEqual([PAGE_A, PAGE_B]);
  });

  it("checks robots.txt first and sends nothing to Diffbot for a page the shop disallows", async () => {
    const { d, id } = setup();
    const f = fakes({ robots: "User-agent: *\nDisallow: /product/toaster\n" });
    const r = await runSource(id, f.deps, d);
    expect(r).toMatchObject({ status: "OK", fetched: 1, created: 1 });
    expect(f.diffbotCalls).toEqual([PAGE_A]);
    const p = await previewSource({ kind: "diffbot", url: "", fieldMap: { urls: PAGE_B } }, f.deps, d);
    expect(p.ok).toBe(false);
    expect(p.skipNote).toContain("robots.txt does not allow it");
    expect(f.diffbotCalls).toEqual([PAGE_A]);
  });

  it("sends nothing to Diffbot when the shop refuses even the robots.txt request", async () => {
    const { d, id } = setup();
    const f = fakes({ robots: 403 });
    const r = await runSource(id, f.deps, d);
    expect(f.diffbotCalls).toEqual([]);
    expect(r.fetched).toBe(0);
    expect(listImportItems({}, d).total).toBe(0);
  });

  it("updates prices later and never hides a page just because it was not in the list", async () => {
    const { d, id } = setup();
    await runSource(id, fakes().deps, d);
    d.prepare("UPDATE catalog_sources SET max_items = 1 WHERE id = ?").run(id);
    const r = await runSource(id, { ...fakes({ pages: { [PAGE_A]: { objects: [object({ offerPrice: "£26.99", offerPriceDetails: { amount: 26.99, symbol: "£" } })] } } }).deps, now: () => Date.parse("2026-10-08T12:00:00Z") }, d);
    expect(r).toMatchObject({ status: "OK", updated: 1, removed: 0 });
    expect((d.prepare("SELECT COUNT(*) AS n FROM products WHERE name = 'Acme Toaster' AND active = 1").get() as { n: number }).n).toBe(1);
  });

  it("explains a missing token, and stops on a bad token or no credits after one call", async () => {
    const none = setup(false);
    expect(await runSource(none.id, fakes().deps, none.d)).toMatchObject({ status: "ERROR", message: expect.stringContaining("Diffbot token") });
    for (const [code, text] of [[401, "did not accept"], [402, "credits have run out"]] as const) {
      const { d, id } = setup();
      const f = fakes({ account: code });
      expect(await runSource(id, f.deps, d)).toMatchObject({ status: "ERROR", message: expect.stringContaining(text) });
      expect(f.diffbotCalls).toHaveLength(1);
    }
  });

  it("previews with a few credits, saves nothing, and needs real addresses to be set up", async () => {
    const { d } = setup();
    const f = fakes();
    const p = await previewSource({ kind: "diffbot", url: "", fieldMap: { urls: `${PAGE_A}\n${PAGE_B}` } }, f.deps, d);
    expect(p).toMatchObject({ ok: true, totalRows: 2 });
    expect(p.sample[0].name).toContain("Kettle");
    expect(listImportItems({}, d).total).toBe(0);
    const shop = listShops({}, d)[0];
    const base = { id: 0, shopId: shop.id, name: "x", kind: "diffbot" as const, url: "", termsUrl: "", termsNote: "", confirmTerms: true, enabled: false, autoPublishNew: true, autoApplyUpdates: true, maxPriceChangePct: 40, maxItems: 50, delayMs: 3000, intervalHours: 24, staleDays: 14, defaultCategory: "", defaultWeightGrams: 500 };
    expect(saveSource({ ...base, fieldMap: { urls: "  \nnot a link" } }, d)).toMatchObject({ ok: false });
    expect(saveSource({ ...base, fieldMap: { urls: "http://127.0.0.1/admin" } }, d)).toMatchObject({ ok: false });
    expect(saveSource({ ...base, fieldMap: { urls: PAGE_A } }, d)).toMatchObject({ ok: true });
    const noToken = openForTest();
    expect((await previewSource({ kind: "diffbot", url: "", fieldMap: { urls: PAGE_A } }, f.deps, noToken)).message).toContain("Diffbot token");
  });
});
