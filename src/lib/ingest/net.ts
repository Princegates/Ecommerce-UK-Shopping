import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { gunzipSync } from "node:zlib";

/**
 * Network layer for reading catalogues. It is deliberately a good citizen:
 *  - it says who it is (an honest User-Agent with a page shops can read),
 *  - it obeys robots.txt and any Crawl-delay,
 *  - it waits between requests to the same host,
 *  - it never reaches private or internal addresses,
 *  - and when a shop says no (403, 429, a challenge page) it stops. It does not retry with a
 *    different identity, rotate addresses or try to get past a challenge.
 */

export const BOT_TOKEN = "ShopCatalogBot";

export function userAgent(appUrl: string | null): string {
  return `${BOT_TOKEN}/1.0${appUrl ? ` (+${appUrl.replace(/\/$/, "")}/bot)` : ""}`;
}

export class BlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedError";
  }
}
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}
export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

// ------------------------------------------------------------------ address safety

/** True for loopback, private, link-local, carrier-grade NAT, multicast and cloud-metadata addresses. */
export function isPrivateAddress(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapped) return isPrivateAddress(mapped[1]);
    return x === "::" || x === "::1" || x.startsWith("fc") || x.startsWith("fd") || /^fe[89ab]/.test(x) || x.startsWith("ff") || x.startsWith("2001:db8");
  }
  return true; // not an address at all: refuse
}

/** Checks the shape of a URL before any request: http(s) only, standard ports, no credentials, no raw internal hosts. */
export function assertFetchableUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UnsafeUrlError("That is not a valid web address.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new UnsafeUrlError("Only http and https addresses can be read.");
  if (u.username || u.password) throw new UnsafeUrlError("Addresses with a username or password are not allowed.");
  if (u.port && u.port !== "80" && u.port !== "443") throw new UnsafeUrlError("Only the standard web ports are allowed.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isPrivateAddress(host)) throw new UnsafeUrlError("That address is not on the public internet.");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UnsafeUrlError("That address is not on the public internet.");
  }
  return u;
}

// ------------------------------------------------------------------ transport

export type HttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  truncated: boolean;
};

export type RequestOptions = { userAgent: string; accept: string; maxBytes: number; timeoutMs: number };

/** The one function that touches the network. Tests replace it. */
export type Fetcher = (url: URL, opts: RequestOptions) => Promise<HttpResponse>;

/**
 * Real transport. The address check happens inside the socket's DNS lookup, so the address we check is the
 * address we connect to (no gap for DNS rebinding).
 */
export const nodeFetcher: Fetcher = (url, opts) =>
  new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        timeout: opts.timeoutMs,
        headers: { "user-agent": opts.userAgent, accept: opts.accept, "accept-encoding": "gzip", "accept-language": "en-GB,en;q=0.8" },
        lookup: (hostname, options, cb) => {
          dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
            if (err) return cb(err, "", 4);
            const list = (addrs as dns.LookupAddress[]) ?? [];
            if (list.length === 0 || list.some((a) => isPrivateAddress(a.address))) {
              return cb(new UnsafeUrlError("That address is not on the public internet.") as NodeJS.ErrnoException, "", 4);
            }
            if ((options as { all?: boolean }).all) return (cb as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
            return cb(null, list[0].address, list[0].family);
          });
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > opts.maxBytes) {
            truncated = true;
            res.destroy();
            return;
          }
          chunks.push(c);
        });
        const done = () => {
          let body: Buffer = Buffer.concat(chunks);
          try {
            if (String(res.headers["content-encoding"] ?? "").includes("gzip") && body.length) body = gunzipLimited(body, opts.maxBytes);
          } catch {
            truncated = true;
          }
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
          resolve({ status: res.statusCode ?? 0, headers, body, truncated });
        };
        res.on("end", done);
        res.on("close", () => { if (truncated) done(); });
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("The request timed out.")));
    req.on("error", reject);
    req.end();
  });

export function gunzipLimited(buf: Buffer, max: number): Buffer {
  const out = gunzipSync(buf, { maxOutputLength: max });
  return out;
}

/** Gunzip when the bytes are a gzip file (some sitemaps are served as .xml.gz), then decode as text. */
export function bodyText(res: HttpResponse, max = 10_000_000): string {
  let b = res.body;
  if (b.length > 2 && b[0] === 0x1f && b[1] === 0x8b) b = gunzipLimited(b, max);
  return b.toString("utf8");
}

// ------------------------------------------------------------------ polite fetching

const CHALLENGE = /(cf-chl|challenge-platform|just a moment\.\.\.|attention required|captcha|are you a human|access denied|px-captcha|datadome|incapsula|distil_r_captcha)/i;

export type PoliteDeps = {
  fetcher?: Fetcher;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  appUrl?: string | null;
};

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const lastHit = new Map<string, number>();

/** Test hook: forget when each host was last contacted. */
export function resetHostClock(): void {
  lastHit.clear();
}

export type PoliteOptions = { delayMs?: number; maxBytes?: number; timeoutMs?: number; accept?: string };

export async function politeFetch(rawUrl: string, deps: PoliteDeps = {}, o: PoliteOptions = {}): Promise<{ res: HttpResponse; finalUrl: string }> {
  const fetcher = deps.fetcher ?? nodeFetcher;
  const sleep = deps.sleep ?? realSleep;
  const now = deps.now ?? Date.now;
  const opts: RequestOptions = {
    userAgent: userAgent(deps.appUrl ?? null),
    accept: o.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
    maxBytes: o.maxBytes ?? 3_000_000,
    timeoutMs: o.timeoutMs ?? 15_000,
  };

  let url = assertFetchableUrl(rawUrl);
  for (let hop = 0; hop <= 3; hop++) {
    const wait = (o.delayMs ?? 0) - (now() - (lastHit.get(url.host) ?? 0));
    if (wait > 0) await sleep(wait);
    lastHit.set(url.host, now());

    const res = await fetcher(url, opts);

    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      url = assertFetchableUrl(new URL(res.headers.location, url).toString());
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 451) {
      throw new BlockedError(`${url.host} refused automated access (HTTP ${res.status}).`);
    }
    if (res.status >= 400) throw new HttpError(res.status, `${url.host} answered HTTP ${res.status}.`);
    if (res.status === 200 && res.body.length < 200_000) {
      const head = res.body.subarray(0, 4000).toString("utf8");
      if (CHALLENGE.test(head) && !/<script[^>]+application\/ld\+json/i.test(res.body.toString("utf8"))) {
        throw new BlockedError(`${url.host} showed a verification page instead of the content.`);
      }
    }
    return { res, finalUrl: url.toString() };
  }
  throw new HttpError(310, "Too many redirects.");
}

// ------------------------------------------------------------------ robots.txt

export type RobotsRules = { allow: boolean; delaySeconds: number | null; test: (path: string) => boolean };

const ALLOW_ALL: RobotsRules = { allow: true, delaySeconds: null, test: () => true };
const DENY_ALL: RobotsRules = { allow: false, delaySeconds: null, test: () => false };

function patternToRegex(p: string): RegExp {
  const anchored = p.endsWith("$");
  const body = (anchored ? p.slice(0, -1) : p).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Reads the group for our token (or `*`). The longest matching rule wins; Allow wins a tie. */
export function parseRobots(text: string, token = BOT_TOKEN): RobotsRules {
  type Group = { agents: string[]; rules: { allow: boolean; pattern: string }[]; delay: number | null };
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const field = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (field === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [], delay: null };
        groups.push(cur);
      }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (field === "allow" || field === "disallow") {
      if (value !== "") cur.rules.push({ allow: field === "allow", pattern: value });
    } else if (field === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) cur.delay = n;
    }
  }
  const t = token.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && t.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  if (chosen.length === 0) return ALLOW_ALL;
  const rules = chosen.flatMap((g) => g.rules.map((r) => ({ ...r, re: patternToRegex(r.pattern), len: r.pattern.length })));
  const delay = chosen.map((g) => g.delay).find((d) => d !== null) ?? null;
  return {
    allow: true,
    delaySeconds: delay,
    test(path: string) {
      let best: { allow: boolean; len: number } | null = null;
      for (const r of rules) {
        if (!r.re.test(path)) continue;
        if (!best || r.len > best.len || (r.len === best.len && r.allow)) best = { allow: r.allow, len: r.len };
      }
      return best ? best.allow : true;
    },
  };
}

/** Looks up and remembers robots.txt for each host during one run. */
export class RobotsCache {
  private cache = new Map<string, RobotsRules>();
  constructor(private deps: PoliteDeps = {}) {}

  async rulesFor(url: URL): Promise<RobotsRules> {
    const origin = `${url.protocol}//${url.host}`;
    const hit = this.cache.get(origin);
    if (hit) return hit;
    let rules: RobotsRules;
    try {
      const { res } = await politeFetch(`${origin}/robots.txt`, this.deps, { accept: "text/plain,*/*;q=0.5", maxBytes: 500_000, delayMs: 1000 });
      rules = parseRobots(res.body.toString("utf8"));
    } catch (e) {
      if (e instanceof HttpError && e.status >= 400 && e.status < 500) rules = ALLOW_ALL; // no robots.txt file
      else rules = DENY_ALL; // blocked or unreachable: do not assume it is fine
    }
    this.cache.set(origin, rules);
    return rules;
  }

  async allowed(url: URL): Promise<{ ok: boolean; delaySeconds: number | null }> {
    const rules = await this.rulesFor(url);
    return { ok: rules.allow && rules.test(url.pathname + url.search), delaySeconds: rules.delaySeconds };
  }
}
