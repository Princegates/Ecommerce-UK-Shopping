import { describe, expect, it } from "vitest";
import { DEPARTMENT_ICONS, departmentIconKey } from "./department-icons";

describe("department icons", () => {
  it("picks an icon from the words in a department name", () => {
    const cases: [string, string][] = [
      ["Fashion", "fashion"], ["fashion", "fashion"], ["Sports", "sports"], ["Electronics", "electronics"], ["Baby & Kids", "baby"], ["Beauty & Health", "beauty"],
      ["Health & Pharmacy", "health"], ["Home & Furniture", "furniture"], ["Home & Kitchen", "kitchen"], ["Books", "books"], ["Tools & DIY", "tools"],
      ["Garden", "garden"], ["Automotive", "auto"], ["Food & Grocery", "food"], ["Pets", "pets"], ["Jewellery & Watches", "jewellery"], ["Shoes", "shoes"],
      ["Phones & Tablets", "phones"], ["Computers", "computers"], ["Toys & Games", "toys"], ["Gifts", "gifts"], ["Music", "music"], ["Cameras", "cameras"],
      ["Travel", "travel"], ["Cycling", "cycling"], ["Camping & Outdoors", "outdoors"], ["Womenswear", "dress"], ["Menswear", "fashion"], ["Marketplace", "shop"],
    ];
    for (const [name, key] of cases) expect([name, departmentIconKey(name)]).toEqual([name, key]);
  });

  it("falls back to the storefront icon and never to an icon that does not exist", () => {
    expect(departmentIconKey("")).toBe("shop");
    expect(departmentIconKey("Zzzz")).toBe("shop");
    for (const name of ["Fashion", "", "x", "Garden & Patio", "Eyewear", "Wedding", "Gaming", "Appliances", "Lighting", "Bedding", "Art & Crafts", "Office"]) {
      expect(DEPARTMENT_ICONS[departmentIconKey(name)]).toBeTruthy();
    }
  });

  it("gives every icon a drawable path, and every rule target exists", () => {
    for (const [key, d] of Object.entries(DEPARTMENT_ICONS)) expect([key, /^M[\d\s.,MLHVCSQTAZmlhvcsqtaz-]+$/.test(d)]).toEqual([key, true]);
    expect(Object.keys(DEPARTMENT_ICONS).length).toBeGreaterThanOrEqual(35);
  });
});
