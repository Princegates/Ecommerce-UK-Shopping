import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";
import { themeVars } from "@/lib/themes";

// The shop's name and colours come from the admin settings, so this is built for each request rather than once at build time.
export const dynamic = "force-dynamic";

/**
 * Lets a phone install the shop like an app, and (on Android) puts it in the Share menu: in the Amazon app, Share then the shop sends the
 * item's link straight to the request form.
 */
export default function manifest(): MetadataRoute.Manifest {
  const { siteName, theme } = getSettings();
  const colours = themeVars(theme);
  return {
    name: siteName,
    short_name: siteName.length > 12 ? siteName.slice(0, 12).trim() : siteName,
    description: "Shop UK stores, including Amazon UK, and pay in cedis.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: colours["--paper"],
    theme_color: colours["--navy"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: { action: "/request/share", method: "GET", params: { title: "title", text: "text", url: "url" } },
  };
}
