import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate, openForTest } from "./db";
import { upsertProduct, upsertShop } from "./admin";
import { getShop, getProductById } from "./catalog";
import { SCHEMA } from "./schema";

const base = { tagline: "", category: "Shoes", websiteUrl: "", description: "", accent: "#123456", active: true, sort: 5 };

describe("shop logos", () => {
  it("saves a logo, keeps it when the shop is saved without one, and removes it on request", () => {
    const d = openForTest();
    const id = upsertShop({ ...base, id: 0, name: "Logo Shop", logoUrl: "/uploads/" + "a".repeat(32) + ".png" }, d);
    expect(getShop("logo-shop", d)?.logoUrl).toBe("/uploads/" + "a".repeat(32) + ".png");
    upsertShop({ ...base, id, name: "Logo Shop", tagline: "new tagline" }, d); // logoUrl left out
    expect(getShop("logo-shop", d)).toMatchObject({ logoUrl: "/uploads/" + "a".repeat(32) + ".png", tagline: "new tagline" });
    upsertShop({ ...base, id, name: "Logo Shop", logoUrl: "https://cdn.example/logo.svg" }, d);
    expect(getShop("logo-shop", d)?.logoUrl).toBe("https://cdn.example/logo.svg");
    upsertShop({ ...base, id, name: "Logo Shop", logoUrl: "" }, d);
    expect(getShop("logo-shop", d)?.logoUrl).toBe("");
  });

  it("starts without a logo and shows it on the shop's products", () => {
    const d = openForTest();
    const id = upsertShop({ ...base, id: 0, name: "Plain Shop" }, d);
    expect(getShop("plain-shop", d)?.logoUrl).toBe("");
    upsertShop({ ...base, id, name: "Plain Shop", logoUrl: "https://cdn.example/l.png" }, d);
    const pid = upsertProduct({ id: 0, shopId: id, name: "Boot", brand: "", category: "Shoes", description: "", priceMinor: 5000, weightGrams: 800, options: [], imageUrl: "", sourceUrl: "", active: true, compareAtMinor: null, dealEndsAt: null }, d);
    expect(getProductById(pid, d)?.shopLogoUrl).toBe("https://cdn.example/l.png");
  });

  it("adds the logo column to an existing database", () => {
    const d = new Database(":memory:");
    d.exec(SCHEMA.replace("  logo_url    TEXT NOT NULL DEFAULT '',\n", ""));
    expect((d.prepare("PRAGMA table_info(shops)").all() as { name: string }[]).some((c) => c.name === "logo_url")).toBe(false);
    migrate(d);
    expect((d.prepare("PRAGMA table_info(shops)").all() as { name: string }[]).some((c) => c.name === "logo_url")).toBe(true);
  });
});
