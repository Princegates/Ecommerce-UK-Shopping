import { appUrl } from "./app-url";
import { DEMO_PRODUCTS, type DemoProduct } from "./demo-shop-data";

/**
 * A pretend UK shop that lives on your own site, so you can watch the catalogue importer work on the real server:
 * a product feed (CSV), a sitemap and product pages with the product data a real shop publishes. Nothing here is a real
 * retailer. It is read-only, hidden from search engines, and can be switched off with DISABLE_DEMO_SHOP=true.
 */
export const demoEnabled = (env: NodeJS.ProcessEnv = process.env) => env.DISABLE_DEMO_SHOP !== "true";

/** The address of this site. APP_URL when set, otherwise the address the request came in on. */
export function demoBase(req?: Request): string {
  const configured = appUrl();
  if (configured && !(req && process.env.NODE_ENV !== "production" && !process.env.APP_URL)) return configured;
  return req ? new URL(req.url).origin : "http://localhost:3000";
}

export type DemoRow = DemoProduct & { stock: boolean; photo: boolean };

/**
 * "day 1" is the shop as first seen. "day 2" is the same shop a day later, so a second run shows how changes are handled:
 * one small price change, one price that doubles (held for review), one item gone, one new item with no photo.
 */
export function demoRows(day: 1 | 2): DemoRow[] {
  const rows: DemoRow[] = DEMO_PRODUCTS.map((p) => ({ ...p, stock: p.id !== "h-1010" || day === 2, photo: true }));
  if (day === 1) return rows;
  const out = rows.filter((p) => p.id !== "h-1012").map((p) => {
    if (p.id === "h-1001") return { ...p, price: 59 };
    if (p.id === "h-1004") return { ...p, price: 150 };
    return p;
  });
  out.push({ id: "h-1013", name: "Wool Blend Scarf", price: 19, rrp: null, category: "Accessories", description: "Soft wool-blend scarf in oatmeal.", stock: true, photo: false });
  return out;
}

export const demoDay = (raw: string | null): 1 | 2 => (raw === "2" ? 2 : 1);

const csvCell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function demoFeedCsv(base: string, day: 1 | 2): string {
  const head = "aw_product_id,product_name,search_price,rrp_price,currency,aw_deep_link,aw_image_url,brand_name,merchant_category,in_stock,description";
  const lines = demoRows(day).map((p) =>
    [
      p.id, p.name, p.price.toFixed(2), p.rrp ? p.rrp.toFixed(2) : "", "GBP", `${base}/demo-shop/p/${p.id}?aff=demo`,
      p.photo ? `${base}/products/demo/${p.id}.svg` : "", "Harbour & Pine", p.category, p.stock ? "1" : "out of stock", p.description,
    ].map(csvCell).join(","),
  );
  return [head, ...lines].join("\n") + "\n";
}

export function demoSitemapXml(base: string): string {
  const urls = DEMO_PRODUCTS.map((p) => `  <url><loc>${base}/demo-shop/p/${p.id}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
