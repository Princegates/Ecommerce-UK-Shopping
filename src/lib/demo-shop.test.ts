import { describe, expect, it } from "vitest";
import { demoFeedCsv, demoRows, demoSitemapXml } from "./demo-shop";
import { DEMO_PRODUCTS } from "./demo-shop-data";
import { csvToRecords, mapRecord, parseSitemap } from "./ingest/parse";
import { parseRobots } from "./ingest/net";

const BASE = "https://shop.example";

describe("demo shop", () => {
  it("publishes a feed the importer reads completely, with photos and a was-price", () => {
    const items = csvToRecords(demoFeedCsv(BASE, 1)).map((r) => mapRecord(r));
    expect(items.every((x) => "item" in x)).toBe(true);
    const first = (items[0] as { item: { imageUrl: string; compareAtMinor: number | null; priceMinor: number } }).item;
    expect(first.imageUrl).toBe(`${BASE}/products/demo/h-1001.svg`);
    expect(first.compareAtMinor).toBe(6900);
    expect(first.priceMinor).toBe(5400);
    expect(items).toHaveLength(DEMO_PRODUCTS.length);
  });

  it("day 2 changes things the way the walkthrough says", () => {
    const day1 = demoRows(1), day2 = demoRows(2);
    expect(day2.find((p) => p.id === "h-1001")!.price).toBeGreaterThan(day1.find((p) => p.id === "h-1001")!.price);
    expect(day2.find((p) => p.id === "h-1004")!.price).toBe(150);
    expect(day2.some((p) => p.id === "h-1012")).toBe(false);
    expect(day2.find((p) => p.id === "h-1013")!.photo).toBe(false);
    expect(day1.find((p) => p.id === "h-1010")!.stock).toBe(false);
    expect(day2.find((p) => p.id === "h-1010")!.stock).toBe(true);
  });

  it("lists every page in the sitemap on the same host", () => {
    const { urls } = parseSitemap(demoSitemapXml(BASE));
    expect(urls).toHaveLength(DEMO_PRODUCTS.length);
    expect(urls.every((u) => u.startsWith(`${BASE}/demo-shop/p/`))).toBe(true);
  });

  it("robots.txt lets our reader into the demo shop and nowhere else on the site", () => {
    const rules = parseRobots("User-agent: ShopCatalogBot\nAllow: /demo-shop/\nDisallow: /\nCrawl-delay: 2\n\nUser-agent: *\nAllow: /\nDisallow: /demo-shop\n");
    expect(rules.test("/demo-shop/p/h-1001")).toBe(true);
    expect(rules.test("/account")).toBe(false);
    expect(rules.test("/products/x")).toBe(false);
    expect(rules.delaySeconds).toBe(2);
  });
});
