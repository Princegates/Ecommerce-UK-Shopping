import { describe, expect, it } from "vitest";
import { openForTest } from "../db";
import { listShops } from "../catalog";
import { importFile, runDueSources, runSource } from "./run";
import { listImportItems, saveSource } from "./store";

function setup(over: { confirmTerms?: boolean; kind?: "upload" | "feed_csv" } = {}) {
  const d = openForTest();
  const shop = listShops({}, d)[0];
  const r = saveSource(
    {
      id: 0, shopId: shop.id, name: "Octoparse export", kind: over.kind ?? "upload", url: over.kind === "feed_csv" ? "https://feeds.example/f.csv" : "", fieldMap: {}, termsUrl: "", termsNote: "My own data", confirmTerms: over.confirmTerms ?? true,
      enabled: over.confirmTerms ?? true, autoPublishNew: true, autoApplyUpdates: true, maxPriceChangePct: 40, maxItems: 50, delayMs: 2000, intervalHours: 24, staleDays: 30, defaultCategory: "Shoes", defaultWeightGrams: 900,
    },
    d,
  );
  if (!r.ok) throw new Error(r.error);
  return { d, id: r.id, shop };
}

const CSV = [
  "title,price,url,image,brand",
  "Trail Boot,£59.99,https://shop.example/p/1,https://img.example/1.jpg,Acme",
  "Rain Coat,34.00,https://shop.example/p/2,https://img.example/2.jpg,Acme",
  "Bad Row,,https://shop.example/p/3,https://img.example/3.jpg,Acme",
].join("\n");

describe("file import source", () => {
  it("brings in rows from a CSV with photos and links, skipping unusable rows", () => {
    const { d, id, shop } = setup();
    const r = importFile(id, "export.csv", CSV, {}, d);
    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.message).toContain("2 read, 2 new");
    const p = d.prepare("SELECT price_minor, image_url, source_url, category, weight_grams FROM products WHERE shop_id = ? AND name = 'Trail Boot'").get(shop.id);
    expect(p).toEqual({ price_minor: 5999, image_url: "https://img.example/1.jpg", source_url: "https://shop.example/p/1", category: "Shoes", weight_grams: 900 });
  });

  it("reads JSON too, and updating the same file again changes prices without duplicating", () => {
    const { d, id } = setup();
    const json = (price: string) => JSON.stringify([{ name: "Trail Boot", price, url: "https://shop.example/p/1", image: "https://img.example/1.jpg", id: "A1" }]);
    expect(importFile(id, "data.json", json("59.99"), {}, d)).toMatchObject({ ok: true });
    const r = importFile(id, "data.json", json("62.00"), {}, d);
    expect(r.ok && r.message).toContain("1 updated");
    expect(listImportItems({}, d).total).toBe(1);
    expect(d.prepare("SELECT price_minor FROM products WHERE name = 'Trail Boot'").get()).toEqual({ price_minor: 6200 });
  });

  it("never removes products the file does not mention", () => {
    const { d, id } = setup();
    importFile(id, "a.csv", CSV, {}, d);
    importFile(id, "b.csv", "title,price,url,image\nOnly One,20.00,https://shop.example/p/9,https://img.example/9.jpg", {}, d);
    expect((d.prepare("SELECT COUNT(*) AS n FROM products WHERE name IN ('Trail Boot','Rain Coat') AND active = 1").get() as { n: number }).n).toBe(2);
  });

  it("refuses files with nothing usable, and sources without confirmed permission", () => {
    const { d, id } = setup();
    expect(importFile(id, "x.csv", "foo,bar\n1,2", {}, d)).toMatchObject({ ok: false });
    expect(importFile(id, "x.csv", "", {}, d)).toMatchObject({ ok: false });
    const unconfirmed = setup({ confirmTerms: false });
    expect(importFile(unconfirmed.id, "a.csv", CSV, {}, unconfirmed.d)).toMatchObject({ ok: false });
  });

  it("only works on file-import sources, and is never run by the scheduler", async () => {
    const feed = setup({ kind: "feed_csv" });
    expect(importFile(feed.id, "a.csv", CSV, {}, feed.d)).toMatchObject({ ok: false });
    const { d, id } = setup();
    expect(await runSource(id, {}, d)).toMatchObject({ status: "SKIPPED" });
    expect((await runDueSources({}, d)).ran).toEqual([]);
  });
});
