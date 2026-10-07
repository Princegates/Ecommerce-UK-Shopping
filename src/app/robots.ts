import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const base = appUrl();
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/api/", "/cart", "/checkout", "/pay/", "/order/", "/login", "/register", "/reset-password/"] },
    ],
    ...(base ? { host: base } : {}),
  };
}
