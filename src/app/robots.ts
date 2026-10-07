import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const base = appUrl();
  return {
    rules: [
      // our own catalogue reader may only look at the built-in demo shop on this site
      { userAgent: "ShopCatalogBot", allow: ["/demo-shop/"], disallow: ["/"], crawlDelay: 2 },
      { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/api/", "/cart", "/checkout", "/pay/", "/order/", "/login", "/register", "/reset-password/", "/demo-shop"] },
    ],
    ...(base ? { host: base } : {}),
  };
}
