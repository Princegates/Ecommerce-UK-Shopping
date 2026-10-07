/**
 * The public address of this site, used for payment return links and message links.
 * Set APP_URL (for example https://shop.example.com). It is never taken from request
 * headers, so a forged Host header cannot send customers to another site.
 */
export function appUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.APP_URL?.trim();
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol === "https:" || (u.protocol === "http:" && env.NODE_ENV !== "production")) {
        return u.origin + u.pathname.replace(/\/+$/, "");
      }
    } catch {
      return null;
    }
    return null;
  }
  return env.NODE_ENV !== "production" ? "http://localhost:3000" : null;
}

export function appHost(env: NodeJS.ProcessEnv = process.env): string {
  const u = appUrl(env);
  try {
    return u ? new URL(u).hostname : "example.com";
  } catch {
    return "example.com";
  }
}
