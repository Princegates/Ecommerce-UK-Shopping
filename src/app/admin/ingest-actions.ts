"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { parseFieldMap } from "@/lib/ingest/field-map";
import { importLinks, previewSource, publishItem, rejectItem, runSource, type LinkResult, type Preview } from "@/lib/ingest/run";
import { SOURCE_KINDS, deleteSource, getSource, getSourceUrl, saveSource, setSourceEnabled, type SourceKind } from "@/lib/ingest/store";
import { db } from "@/lib/db";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string, fallback = 0) => {
  const n = Number(str(f, k));
  return Number.isFinite(n) ? n : fallback;
};
const on = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "1";

function back(path: string, params: Record<string, string>): never {
  revalidatePath("/", "layout");
  const q = new URLSearchParams(params).toString();
  redirect(`${path}${q ? `?${q}` : ""}`);
}

export async function saveSourceAction(f: FormData): Promise<void> {
  await requireAdmin();
  const id = num(f, "id");
  const kind = str(f, "kind") as SourceKind;
  const result = saveSource({
    id,
    shopId: num(f, "shopId"),
    name: str(f, "name"),
    kind: SOURCE_KINDS.some((k) => k.kind === kind) ? kind : "feed_csv",
    url: str(f, "url"),
    fieldMap: kind === "ebay" ? { queries: String(f.get("fieldMap") ?? "") } : parseFieldMap(str(f, "fieldMap")),
    termsUrl: str(f, "termsUrl"),
    termsNote: str(f, "termsNote"),
    confirmTerms: on(f, "confirmTerms"),
    enabled: on(f, "enabled"),
    autoPublishNew: on(f, "autoPublishNew"),
    autoApplyUpdates: on(f, "autoApplyUpdates"),
    maxPriceChangePct: num(f, "maxPriceChangePct", 40),
    maxItems: num(f, "maxItems", 50),
    delayMs: Math.round(num(f, "delaySeconds", 3) * 1000),
    intervalHours: num(f, "intervalHours", 24),
    staleDays: num(f, "staleDays", 14),
    defaultCategory: str(f, "defaultCategory"),
    defaultWeightGrams: num(f, "defaultWeightGrams", 500),
  });
  const path = id > 0 ? `/admin/sources/${id}` : "/admin/sources/new";
  if (!result.ok) back(path, { error: result.error });
  audit(id > 0 ? "source.update" : "source.create", str(f, "name"), `${kind}`);
  back(`/admin/sources/${result.id}`, { saved: "1" });
}

export async function deleteSourceAction(f: FormData): Promise<void> {
  await requireAdmin();
  const id = num(f, "id");
  const name = getSource(id)?.name ?? `#${id}`;
  const removeProducts = str(f, "mode") === "remove";
  const r = deleteSource(id, removeProducts);
  if (!r.ok) back(`/admin/sources/${id}`, { error: r.error });
  audit("source.delete", name, removeProducts ? `and ${r.products} product(s)` : "products kept");
  back("/admin/sources", { saved: "1" });
}

export async function toggleSourceAction(f: FormData): Promise<void> {
  await requireAdmin();
  const id = num(f, "id");
  const r = setSourceEnabled(id, on(f, "on"), db());
  if (!r.ok) back("/admin/sources", { error: r.error });
  audit(on(f, "on") ? "source.enable" : "source.disable", getSource(id)?.name ?? `#${id}`);
  back(str(f, "return") === "detail" ? `/admin/sources/${id}` : "/admin/sources", { saved: "1" });
}

/** Starts a run in the background so the page returns at once; the page shows the result when it finishes. */
export async function runSourceNowAction(f: FormData): Promise<void> {
  await requireAdmin();
  const id = num(f, "id");
  const s = getSource(id);
  if (!s) back("/admin/sources", { error: "That source no longer exists." });
  if (!s.termsConfirmedAt) back(`/admin/sources/${id}`, { error: "Confirm the shop's terms first." });
  audit("source.run", s.name, "manual run");
  after(async () => {
    try {
      await runSource(id);
    } catch (e) {
      console.error("[ingest] manual run failed", e instanceof Error ? e.message : "unknown");
    }
  });
  back(`/admin/sources/${id}`, { started: "1" });
}

export type PreviewState = { preview?: Preview; error?: string };

export async function previewSourceAction(_prev: PreviewState, f: FormData): Promise<PreviewState> {
  await requireAdmin();
  const kind = str(f, "kind") as SourceKind;
  if (!SOURCE_KINDS.some((k) => k.kind === kind) || kind === "links") return { error: "Choose a feed, sitemap or eBay type to preview." };
  if (kind === "ebay") return { preview: await previewSource({ kind, url: "", fieldMap: { queries: String(f.get("fieldMap") ?? "") } }) };
  const id = num(f, "id");
  const url = str(f, "url") || (id > 0 ? getSourceUrl(id) : "");
  if (!url) return { error: "Enter the feed or sitemap address first." };
  return { preview: await previewSource({ kind, url, fieldMap: parseFieldMap(str(f, "fieldMap")) }) };
}

export type LinksState = { results?: LinkResult[]; error?: string };

export async function importLinksAction(_prev: LinksState, f: FormData): Promise<LinksState> {
  await requireAdmin();
  const shopId = num(f, "shopId");
  if (!db().prepare("SELECT 1 FROM shops WHERE id = ?").get(shopId)) return { error: "Choose the shop these items belong to." };
  const urls = str(f, "urls").split(/\s+/).filter(Boolean);
  if (urls.length === 0) return { error: "Paste at least one product link." };
  if (urls.length > 20) return { error: "Add up to 20 links at a time." };
  const results = await importLinks(urls, { shopId });
  audit("source.links", `shop #${shopId}`, `${results.filter((r) => r.status === "added" || r.status === "updated").length} of ${results.length} links imported`);
  revalidatePath("/", "layout");
  return { results };
}

export async function approveItemAction(f: FormData): Promise<void> {
  await requireAdmin();
  const id = num(f, "id");
  const r = publishItem(id);
  if (!r.ok) back("/admin/import", { error: r.error });
  audit("import.approve", `item #${id}`);
  back(str(f, "return") || "/admin/import", { saved: "1" });
}

export async function rejectItemAction(f: FormData): Promise<void> {
  await requireAdmin();
  const id = num(f, "id");
  rejectItem(id);
  audit("import.reject", `item #${id}`);
  back(str(f, "return") || "/admin/import", { saved: "1" });
}

export async function approveManyAction(f: FormData): Promise<void> {
  await requireAdmin();
  const ids = f.getAll("ids").map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
  const decision = str(f, "decision");
  let n = 0;
  for (const id of ids) {
    if (decision === "reject") { if (rejectItem(id)) n++; }
    else if (publishItem(id).ok) n++;
  }
  audit(decision === "reject" ? "import.reject" : "import.approve", "queue", `${n} item(s)`);
  back(str(f, "return") || "/admin/import", { saved: "1" });
}
