import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "../db";
import { SCHEMA } from "../schema";

describe("widening catalogue source kinds on an existing database", () => {
  it("keeps sources, items and runs, and then accepts the eBay and Shopify kinds", () => {
    const d = new Database(":memory:");
    d.pragma("foreign_keys = ON");
    // a database created before eBay support: the same schema with the old, narrower rule
    d.exec(SCHEMA.replace("'links', 'ebay', 'shopify'))", "'links'))"));
    expect(() => d.prepare("INSERT INTO catalog_sources (shop_id, name, kind) VALUES (1, 'x', 'ebay')").run()).toThrow();
    d.prepare("INSERT INTO shops (id, slug, name, category) VALUES (1, 's', 'Shop', 'Fashion')").run();
    d.prepare("INSERT INTO catalog_sources (id, shop_id, name, kind, url) VALUES (7, 1, 'Feed', 'feed_csv', 'v1:secret')").run();
    d.prepare("INSERT INTO import_items (source_id, external_id, name, price_minor) VALUES (7, 'a', 'Hat', 1000)").run();
    d.prepare("INSERT INTO import_runs (source_id, status) VALUES (7, 'OK')").run();

    migrate(d);

    expect(d.prepare("SELECT name, kind, url FROM catalog_sources WHERE id = 7").get()).toEqual({ name: "Feed", kind: "feed_csv", url: "v1:secret" });
    expect(d.prepare("SELECT COUNT(*) AS n FROM import_items WHERE source_id = 7").get()).toEqual({ n: 1 });
    expect(d.prepare("SELECT COUNT(*) AS n FROM import_runs WHERE source_id = 7").get()).toEqual({ n: 1 });
    expect(() => d.prepare("INSERT INTO catalog_sources (shop_id, name, kind) VALUES (1, 'eBay', 'ebay')").run()).not.toThrow();
    expect(() => d.prepare("INSERT INTO catalog_sources (shop_id, name, kind) VALUES (1, 'Brand', 'shopify')").run()).not.toThrow();
    expect(d.prepare("SELECT options FROM import_items WHERE source_id = 7").get()).toEqual({ options: "[]" });
    // children still point at the rebuilt table
    expect(() => d.prepare("INSERT INTO import_items (source_id, external_id, name, price_minor) VALUES (999, 'b', 'Bad', 1)").run()).toThrow();
    expect(d.pragma("foreign_key_check")).toEqual([]);
    migrate(d); // running it again changes nothing
    expect(d.prepare("SELECT COUNT(*) AS n FROM catalog_sources").get()).toEqual({ n: 3 });
  });

  it("also widens a database that already knows eBay but not Shopify, and adds the options column", () => {
    const d = new Database(":memory:");
    d.pragma("foreign_keys = ON");
    d.exec(SCHEMA.replace(", 'shopify'))", "))").replace("  options        TEXT NOT NULL DEFAULT '[]',\n", ""));
    expect(() => d.prepare("INSERT INTO catalog_sources (shop_id, name, kind) VALUES (1, 'x', 'shopify')").run()).toThrow();
    migrate(d);
    d.prepare("INSERT INTO shops (id, slug, name, category) VALUES (1, 's', 'Shop', 'Fashion')").run();
    expect(() => d.prepare("INSERT INTO catalog_sources (shop_id, name, kind) VALUES (1, 'Brand', 'shopify')").run()).not.toThrow();
    expect((d.prepare("PRAGMA table_info(import_items)").all() as { name: string }[]).some((c) => c.name === "options")).toBe(true);
  });
});
