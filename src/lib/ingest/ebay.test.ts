import { describe, expect, it } from "vitest";
import { openForTest } from "../db";
import { listShops } from "../catalog";
import { getIntegration, saveFields } from "../integrations";
import { biggerEbayImage, buildSearchUrl, mapEbayItem, parseQueries } from "./ebay";
import { previewSource, runSource } from "./run";
import { listImportItems, saveSource } from "./store";

const listing = (over: Record<string, unknown> = {}) => ({
  itemId: "v1|1234567890|0", title: "Acme Kettle 1.7L Stainless Steel", price: { value: "24.99", currency: "GBP" },
  marketingPrice: { originalPrice: { value: "34.99", currency: "GBP" }, discountPercentage: "29" },
  image: { imageUrl: "https://i.ebayimg.com/images/g/AbC/s-l225.jpg" }, itemWebUrl: "https://www.ebay.co.uk/itm/1234567890?hash=x",
  categories: [{ categoryId: "20667", categoryName: "Kettles" }], condition: "New", seller: { username: "acme_store" }, ...over,
});

describe("eBay listings", () => {
  it("maps a listing into a product with its photo, was-price and link back", () => {
    const r = mapEbayItem(listing());
    expect(r).toEqual({
      item: {
        externalId: "ebay-v1|1234567890|0", productUrl: "https://www.ebay.co.uk/itm/1234567890?hash=x", name: "Acme Kettle 1.7L Stainless Steel", brand: "",
        category: "Kettles", description: "Condition: New. Sold on eBay.", priceMinor: 2499, compareAtMinor: 3499,
        imageUrl: "https://i.ebayimg.com/images/g/AbC/s-l500.jpg", inStock: true, weightGrams: null,
      },
    });
  });

  it("keeps no eBay member data: the seller's username is never stored", () => {
    const r = mapEbayItem(listing({ seller: { username: "acme_store", feedbackScore: 99, feedbackPercentage: "100" } }));
    expect(JSON.stringify(r)).not.toContain("acme_store");
  });

  it("skips listings it cannot trust", () => {
    expect(mapEbayItem(listing({ price: { value: "10", currency: "USD" } }))).toEqual({ skip: "price is in USD, not GBP" });
    expect(mapEbayItem(listing({ price: undefined }))).toEqual({ skip: "no valid price" });
    expect(mapEbayItem(listing({ title: "" }))).toEqual({ skip: "no title" });
    expect(mapEbayItem(listing({ itemWebUrl: "javascript:alert(1)" }))).toEqual({ skip: "no link back to the listing" });
    expect(mapEbayItem(listing({ itemId: "" }))).toEqual({ skip: "no item id" });
  });

  it("falls back to the thumbnail, ignores a lower was-price, and enlarges eBay pictures only", () => {
    const r = mapEbayItem(listing({ image: undefined, thumbnailImages: [{ imageUrl: "https://i.ebayimg.com/images/g/Z/s-l140.png" }], marketingPrice: { originalPrice: { value: "10.00", currency: "GBP" } } }));
    expect("item" in r && r.item.imageUrl).toBe("https://i.ebayimg.com/images/g/Z/s-l500.png");
    expect("item" in r && r.item.compareAtMinor).toBeNull();
    expect(biggerEbayImage("https://cdn.example/photo.jpg")).toBe("https://cdn.example/photo.jpg");
  });

  it("asks only for new, fixed-price, UK-located listings priced in pounds", () => {
    const u = new URL(buildSearchUrl("production", "men's trainers", 50));
    expect(u.origin + u.pathname).toBe("https://api.ebay.com/buy/browse/v1/item_summary/search");
    expect(u.searchParams.get("q")).toBe("men's trainers");
    expect(u.searchParams.get("limit")).toBe("50");
    expect(u.searchParams.get("filter")).toBe("buyingOptions:{FIXED_PRICE},conditions:{NEW},itemLocationCountry:GB,priceCurrency:GBP");
    expect(new URL(buildSearchUrl("sandbox", "x", 9999)).searchParams.get("limit")).toBe("200");
    expect(buildSearchUrl("sandbox", "x", 5).startsWith("https://api.sandbox.ebay.com/")).toBe(true);
  });

  it("reads one search per line, tidied, de-duplicated and capped", () => {
    expect(parseQueries("  kettle \n\nKettle\nkettle\nx\n" + "a".repeat(101) + "\nbaby   clothes")).toEqual(["kettle", "Kettle", "baby clothes"]);
    expect(parseQueries(Array.from({ length: 15 }, (_, i) => `search ${i}`).join("\n"))).toHaveLength(10);
  });
});

function setup(keys = true) {
  const d = openForTest();
  if (keys) saveFields(getIntegration("ebay")!, { appId: "Acme-Shop-PRD-abc123", certId: "PRD-secretsecret" }, d);
  const shop = listShops({}, d)[0];
  const r = saveSource(
    {
      id: 0, shopId: shop.id, name: "eBay kettles", kind: "ebay", url: "", fieldMap: { queries: "kettle\ntoaster" }, termsUrl: "", termsNote: "eBay API licence", confirmTerms: true, enabled: true,
      autoPublishNew: true, autoApplyUpdates: true, maxPriceChangePct: 40, maxItems: 50, delayMs: 3000, intervalHours: 6, staleDays: 3, defaultCategory: "", defaultWeightGrams: 1200,
    },
    d,
  );
  if (!r.ok) throw new Error(r.error);
  return { d, id: r.id, shop };
}

function fakeEbay(results: Record<string, unknown[]>, calls: { url: string; auth: string | null; market: string | null }[] = []) {
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const h = new Headers(init?.headers);
    calls.push({ url, auth: h.get("authorization"), market: h.get("x-ebay-c-marketplace-id") });
    if (url.includes("/identity/v1/oauth2/token")) {
      if (h.get("authorization") !== `Basic ${Buffer.from("Acme-Shop-PRD-abc123:PRD-secretsecret").toString("base64")}`) return new Response("{}", { status: 401 });
      return new Response(JSON.stringify({ access_token: "tok-123", expires_in: 7200 }), { status: 200 });
    }
    const q = new URL(url).searchParams.get("q") ?? "";
    return new Response(JSON.stringify({ itemSummaries: results[q] ?? [] }), { status: 200 });
  }) as typeof fetch;
  return { f, calls };
}

const D = { sleep: async () => {}, now: () => Date.parse("2026-10-07T12:00:00Z"), appUrl: "https://shop.example" };

describe("eBay source", () => {
  it("brings listings in with photos, signs in once, and sends the right headers", async () => {
    const { d, id, shop } = setup();
    const { f, calls } = fakeEbay({
      kettle: [listing(), listing({ itemId: "v1|2|0", title: "Budget Kettle 1L", price: { value: "12.00", currency: "GBP" }, marketingPrice: undefined }), listing({ itemId: "v1|3|0", price: { value: "9", currency: "EUR" } })],
      toaster: [listing({ itemId: "v1|2|0" }), listing({ itemId: "v1|4|0", title: "2-Slice Toaster", price: { value: "19.50", currency: "GBP" }, marketingPrice: undefined })],
    });
    const r = await runSource(id, { ...D, ebayFetch: f }, d);
    expect(r).toMatchObject({ status: "OK", fetched: 3, created: 3 });
    expect(r.message).toContain("price is in EUR");
    expect(r.message).toContain("duplicate across searches");
    expect(calls.filter((c) => c.url.includes("oauth2/token"))).toHaveLength(1);
    const search = calls.filter((c) => c.url.includes("item_summary/search"));
    expect(search).toHaveLength(2);
    expect(search.every((c) => c.auth === "Bearer tok-123" && c.market === "EBAY_GB")).toBe(true);
    const p = d.prepare("SELECT price_minor, compare_at_minor, image_url, source_url, weight_grams FROM products WHERE shop_id = ? AND name = 'Acme Kettle 1.7L Stainless Steel'").get(shop.id) as Record<string, unknown>;
    expect(p).toEqual({ price_minor: 2499, compare_at_minor: 3499, image_url: "https://i.ebayimg.com/images/g/AbC/s-l500.jpg", source_url: "https://www.ebay.co.uk/itm/1234567890?hash=x", weight_grams: 1200 });
  });

  it("updates prices later, and never treats a missing listing as removed", async () => {
    const { d, id, shop } = setup();
    await runSource(id, { ...D, ebayFetch: fakeEbay({ kettle: [listing(), listing({ itemId: "v1|2|0", title: "Budget Kettle 1L", price: { value: "12.00", currency: "GBP" } })] }).f }, d);
    const r = await runSource(id, { ...D, now: () => Date.parse("2026-10-08T12:00:00Z"), ebayFetch: fakeEbay({ kettle: [listing({ price: { value: "26.99", currency: "GBP" } })] }).f }, d);
    expect(r).toMatchObject({ status: "OK", updated: 1, removed: 0 });
    const kettles = d.prepare("SELECT name, price_minor, active FROM products WHERE shop_id = ? AND name LIKE '%Kettle%' ORDER BY name").all(shop.id) as { name: string; price_minor: number; active: number }[];
    expect(kettles.find((k) => k.name.startsWith("Acme"))).toMatchObject({ price_minor: 2699, active: 1 });
    expect(kettles.find((k) => k.name.startsWith("Budget"))).toMatchObject({ active: 1 });
  });

  it("explains missing or wrong keys instead of failing silently", async () => {
    const none = setup(false);
    expect(await runSource(none.id, { ...D, ebayFetch: fakeEbay({}).f }, none.d)).toMatchObject({ status: "ERROR", message: expect.stringContaining("eBay App ID and Cert ID") });
    const bad = setup();
    saveFields(getIntegration("ebay")!, { appId: "Wrong-App-Id-0000", certId: "PRD-secretsecret" }, bad.d);
    expect(await runSource(bad.id, { ...D, ebayFetch: fakeEbay({}).f }, bad.d)).toMatchObject({ status: "ERROR", message: expect.stringContaining("did not accept") });
  });

  it("previews without saving anything, and needs searches to be set up", async () => {
    const { d } = setup();
    const p = await previewSource({ kind: "ebay", url: "", fieldMap: { queries: "kettle" } }, { ebayFetch: fakeEbay({ kettle: [listing()] }).f }, d);
    expect(p.ok).toBe(true);
    expect(p.sample[0].name).toContain("Kettle");
    expect(listImportItems({}, d).total).toBe(0);
    const shop = listShops({}, d)[0];
    expect(saveSource({ id: 0, shopId: shop.id, name: "x", kind: "ebay", url: "", fieldMap: { queries: "  \n" }, termsUrl: "", termsNote: "", confirmTerms: true, enabled: false, autoPublishNew: true, autoApplyUpdates: true, maxPriceChangePct: 40, maxItems: 50, delayMs: 3000, intervalHours: 6, staleDays: 3, defaultCategory: "", defaultWeightGrams: 500 }, d)).toMatchObject({ ok: false });
  });
});
