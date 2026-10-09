/**
 * Recognises Amazon product links, so ordering from Amazon is as easy as sending us the link. Nothing here fetches anything:
 * it only reads the address a customer gives us. Amazon's own pages are never requested by the shop.
 */
export type AmazonLink = {
  /** The 10-character product number, when the address has one (short links such as a.co do not). */
  asin: string | null;
  /** "uk" for amazon.co.uk, "us" for amazon.com, "other" for another country's Amazon, "short" for a.co / amzn.to / amzn.eu. */
  store: "uk" | "us" | "other" | "short";
  host: string;
  /** The same product on Amazon UK with every tracking and seller parameter removed, when we can build it. */
  ukUrl: string | null;
};

const SHORT_HOSTS = new Set(["a.co", "amzn.to", "amzn.eu", "amzn.in", "amzn.asia"]);
const ASIN = /(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/gp\/offer-listing\/|\/exec\/obidos\/ASIN\/|\/product\/|\/d\/)([A-Z0-9]{10})(?=[/?#]|$)/;

/** Reads one address. Returns null when it is not an Amazon address at all. */
export function parseAmazonLink(raw: string): AmazonLink | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|smile|smile\.amazon)\./, "");
  if (SHORT_HOSTS.has(host)) return { asin: null, store: "short", host, ukUrl: null };
  const m = /^amazon\.(co\.uk|com|de|fr|it|es|nl|se|pl|ca|com\.au|com\.br|com\.mx|in|co\.jp|ae|sa|sg|com\.tr|eg)$/.exec(host);
  if (!m) return null;
  const asin = ASIN.exec(u.pathname)?.[1] ?? null;
  return { asin, store: m[1] === "co.uk" ? "uk" : m[1] === "com" ? "us" : "other", host, ukUrl: asin ? `https://www.amazon.co.uk/dp/${asin}` : null };
}

/** The first web address in a piece of text, such as what the Amazon app shares: "Check this out: https://a.co/d/abc". */
export function extractFirstUrl(text: string): string {
  const m = /https?:\/\/[^\s<>"')\]]+/i.exec(text);
  return m ? m[0].replace(/[.,;:!?]+$/, "") : "";
}

/**
 * What to store for a link the customer gave us. A UK Amazon address with a product number is cleaned to the plain product page,
 * which removes tracking and the seller choice the customer's browser added. Everything else is kept as it was.
 */
export function normalizeRequestUrl(raw: string): { url: string; amazon: AmazonLink | null } {
  const text = raw.trim();
  const url = /^https?:\/\//i.test(text) ? text : extractFirstUrl(text) || text;
  const amazon = parseAmazonLink(url);
  if (amazon?.store === "uk" && amazon.ukUrl) return { url: amazon.ukUrl, amazon };
  return { url, amazon };
}

/** The sentence shown when a customer sends a link from an Amazon store we do not buy from. */
export function wrongStoreMessage(link: AmazonLink): string {
  const where = link.store === "us" ? "Amazon's US store (amazon.com)" : "another country's Amazon";
  return link.ukUrl
    ? `That link is for ${where}. We buy from Amazon UK and ship from the UK. Open the same item on Amazon UK and send that link, for example ${link.ukUrl}. If it is not sold there, send us a different one.`
    : `That link is for ${where}. We buy from Amazon UK and ship from the UK. Please find the item on amazon.co.uk and send that link.`;
}
