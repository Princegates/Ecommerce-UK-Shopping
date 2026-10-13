import type { OptionGroup } from "./catalog";


type Ok<T> = { ok: true; value: T };
type Err = { ok: false; error: string };

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

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
