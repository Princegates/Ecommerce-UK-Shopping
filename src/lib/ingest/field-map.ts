import type { FieldMap } from "./parse";

const KEYS = ["id", "name", "price", "compareAt", "currency", "url", "image", "brand", "category", "description", "stock", "weight", "include", "exclude"] as const;

/** "name=product_title" lines into a field map. Unknown keys are ignored; values are trimmed and capped. */
export function parseFieldMap(text: string): FieldMap {
  const map: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim().slice(0, 200);
    const match = KEYS.find((k) => k.toLowerCase() === key.toLowerCase());
    if (match && value) map[match] = value;
  }
  return map as FieldMap;
}

export function formatFieldMap(map: FieldMap): string {
  return KEYS.filter((k) => map[k]).map((k) => `${k}=${map[k]}`).join("\n");
}
