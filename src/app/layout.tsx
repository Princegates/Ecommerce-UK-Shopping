import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque/wdth.css";
import "@fontsource-variable/figtree";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { themeVars } from "@/lib/themes";

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = getSettings();
  return {
    title: { default: `${siteName}: shop UK stores, pay in cedis`, template: `%s | ${siteName}` },
    description:
      "Browse UK shops, see the full price in Ghana cedis, pay once and track your order to your door in Ghana.",
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={themeVars(getSettings().theme) as React.CSSProperties}>
      <body>
        <noscript><style>{".reveal{opacity:1!important;transform:none!important}.slide .stagger>*{opacity:1!important}"}</style></noscript>
        {children}
      </body>
    </html>
  );
}
