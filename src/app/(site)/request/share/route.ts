import { NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { extractFirstUrl } from "@/lib/amazon-links";

export const dynamic = "force-dynamic";

/**
 * Where the phone's Share menu sends an item (see the web app manifest). Android apps put the link in "url" or inside the shared
 * "text" ("Check out this item! https://a.co/d/abc"), so both are searched. Nothing is fetched or saved here: the customer lands on
 * the request form with the link and name filled in, and sends the request themselves.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const title = (sp.get("title") ?? "").slice(0, 300);
  const text = (sp.get("text") ?? "").slice(0, 2000);
  const url = extractFirstUrl((sp.get("url") ?? "").slice(0, 2000)) || extractFirstUrl(text);
  const name = (title || text.replace(url, "").replace(/^\s*check\s+(?:this\s+|it\s+)?out[:!.,\s-]*/i, ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  const q = new URLSearchParams();
  if (url) q.set("url", url);
  if (name) q.set("title", name);
  return NextResponse.redirect(new URL(`/request${q.size ? `?${q}` : ""}`, appUrl() ?? req.url), 303);
}
