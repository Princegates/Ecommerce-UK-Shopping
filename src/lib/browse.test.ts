import { describe, expect, it } from "vitest";
import { browseHref, parseBrowse, toQuery, without } from "./browse";

const fx = { rate: 10, markupPct: 0 };
const depts = new Map([["fashion", "Fashion"], ["home-and-furniture", "Home & Furniture"]]);

describe("parseBrowse", () => {
  it("reads single and repeated values", () => {
    const p = parseBrowse({ q: " trainers ", d: ["fashion", "sports"], shop: "northgate-fashion", min: "50", max: "500.5", deals: "1", sort: "price-asc", page: "3" });
    expect(p).toMatchObject({ q: "trainers", d: ["fashion", "sports"], shop: ["northgate-fashion"], min: "50", max: "500.5", deals: true, sort: "price-asc", page: 3 });
  });
  it("falls back safely on junk", () => {
    const p = parseBrowse({ q: "x".repeat(500), sort: "drop table", page: "-4", min: "abc", max: "1e9", d: ["", "  "], deals: "yes" });
    expect(p.q).toHaveLength(80);
    expect(p).toMatchObject({ sort: "popular", page: 1, min: "", max: "", d: [], deals: false });
    expect(parseBrowse({ page: "9999" }).page).toBe(1);
    expect(parseBrowse({}).page).toBe(1);
  });
  it("caps how many filter values it accepts", () => {
    expect(parseBrowse({ shop: Array.from({ length: 100 }, (_, i) => `s${i}`) }).shop).toHaveLength(30);
  });
});

describe("toQuery", () => {
  it("converts cedi price bounds to pounds at the current rate and maps departments", () => {
    const q = toQuery(parseBrowse({ d: "fashion", min: "100", max: "1000", page: "2" }), fx, depts);
    expect(q.minGbpMinor).toBe(1000); // GH₵100 at 10 per £ is £10
    expect(q.maxGbpMinor).toBe(10000);
    expect(q.departments).toEqual(["Fashion"]);
    expect(q.offset).toBe(24);
    expect(q.limit).toBe(24);
  });
  it("ignores unknown departments and honours a fixed one", () => {
    expect(toQuery(parseBrowse({ d: "nope" }), fx, depts).departments).toBeUndefined();
    expect(toQuery(parseBrowse({ d: "fashion" }), fx, depts, ["Sports"]).departments).toEqual(["Sports"]);
  });
});

describe("browseHref", () => {
  it("round-trips and resets to page 1 when a filter changes", () => {
    const p = parseBrowse({ q: "shoe", shop: ["a", "b"], sort: "rating", page: "4" });
    expect(browseHref("/search", p, { page: 4 })).toBe("/search?q=shoe&shop=a&shop=b&sort=rating&page=4");
    expect(browseHref("/search", p, { shop: without(p.shop, "a") })).toBe("/search?q=shoe&shop=b&sort=rating");
    expect(browseHref("/search", parseBrowse({}), {})).toBe("/search");
  });
});
