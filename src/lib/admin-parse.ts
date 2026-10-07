import type { OptionGroup } from "./catalog";
import type { RateCard, ServiceFeeRule } from "./pricing";
import { minorToInput, parseMinor } from "./money";

type Ok<T> = { ok: true; value: T };
type Err = { ok: false; error: string };

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

/** "500, 60.00" per line: parcels up to 500 g cost GH₵60. */
export function parseBrackets(text: string): Ok<RateCard["brackets"]> | Err {
  const out: RateCard["brackets"] = [];
  for (const line of lines(text)) {
    const [g, price, ...rest] = line.split(",").map((s) => s.trim());
    const grams = Number(g);
    const priceMinor = price === undefined ? null : parseMinor(price);
    if (rest.length || !Number.isInteger(grams) || grams <= 0 || priceMinor === null) {
      return { ok: false, error: `Could not read “${line}”. Use “grams, price”, for example “500, 60.00”.` };
    }
    out.push({ upToGrams: grams, priceMinor });
  }
  if (out.length === 0) return { ok: false, error: "Add at least one weight bracket." };
  out.sort((a, b) => a.upToGrams - b.upToGrams);
  for (let i = 1; i < out.length; i++) {
    if (out[i].upToGrams === out[i - 1].upToGrams) return { ok: false, error: "Two brackets have the same weight." };
  }
  return { ok: true, value: out };
}

export function bracketsToText(b: RateCard["brackets"]): string {
  return b.map((x) => `${x.upToGrams}, ${minorToInput(x.priceMinor)}`).join("\n");
}

type Tiers = Extract<ServiceFeeRule, { mode: "tiered" }>["tiers"];

/** "50, 15" per line: item totals up to £50 pay 15%. The last line must be "*, 8" (no upper limit). */
export function parseTiers(text: string): Ok<Tiers> | Err {
  const out: Tiers = [];
  for (const line of lines(text)) {
    const [limit, pct, ...rest] = line.split(",").map((s) => s.trim());
    const percent = Number(pct);
    const upTo = limit === "*" ? null : parseMinor(limit ?? "");
    if (rest.length || pct === undefined || !Number.isFinite(percent) || percent < 0 || percent > 100 || (limit !== "*" && upTo === null)) {
      return { ok: false, error: `Could not read “${line}”. Use “pounds, percent”, for example “50, 15”, and “*, 8” for the last band.` };
    }
    out.push({ upToGbpMinor: upTo, percent });
  }
  if (out.length === 0) return { ok: false, error: "Add at least one band." };
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i].upToGbpMinor;
    const b = out[i + 1].upToGbpMinor;
    if (a === null) return { ok: false, error: "“*” must be on the last line only." };
    if (b !== null && b <= a) return { ok: false, error: "Band limits must increase from top to bottom." };
  }
  if (out[out.length - 1].upToGbpMinor !== null) return { ok: false, error: "The last band must be “*, percent” so every basket is covered." };
  return { ok: true, value: out };
}

export function tiersToText(t: Tiers): string {
  return t.map((x) => `${x.upToGbpMinor === null ? "*" : minorToInput(x.upToGbpMinor)}, ${x.percent}`).join("\n");
}

/** "Size: UK 6, UK 7" per line. */
export function parseOptionGroups(text: string): Ok<OptionGroup[]> | Err {
  const out: OptionGroup[] = [];
  for (const line of lines(text)) {
    const i = line.indexOf(":");
    const name = i > 0 ? line.slice(0, i).trim() : "";
    const values = i > 0 ? line.slice(i + 1).split(",").map((v) => v.trim()).filter(Boolean) : [];
    if (!name || values.length === 0) return { ok: false, error: `Could not read “${line}”. Use “Size: S, M, L”.` };
    if (new Set(values).size !== values.length) return { ok: false, error: `“${name}” lists a value twice.` };
    out.push({ name: name.slice(0, 30), values: values.map((v) => v.slice(0, 30)) });
  }
  if (out.length > 6) return { ok: false, error: "Use at most 6 option groups." };
  if (new Set(out.map((g) => g.name.toLowerCase())).size !== out.length) return { ok: false, error: "Two option groups have the same name." };
  if (out.some((g) => g.values.length > 30)) return { ok: false, error: "Use at most 30 values per option." };
  return { ok: true, value: out };
}

export function optionGroupsToText(groups: OptionGroup[]): string {
  return groups.map((g) => `${g.name}: ${g.values.join(", ")}`).join("\n");
}

/** Only http(s) links, so a stored link can never be a javascript: URL. */
export function safeUrl(input: string): string | null {
  const v = input.trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function isHexColour(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}
