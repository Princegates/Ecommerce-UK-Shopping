/** One product page address per line, http or https only, no repeats, at most 200. (Kept apart from the API client so forms can use it.) */
export function parseProductUrls(text: string): string[] {
  const out = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
      u.hash = "";
      out.add(u.toString().slice(0, 1000));
    } catch {
      /* not an address: ignored */
    }
  }
  return [...out].slice(0, 200);
}
