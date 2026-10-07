"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  clearLoginFailures, adminConfig, clientKey, endAdminSession, loginAllowed, passwordMatches, recordLoginFailure,
  requireAdmin, startAdminSession,
} from "@/lib/auth";
import { isUploadUrl, saveImage } from "@/lib/uploads";
import { parseBrackets, parseOptionGroups, parseTiers, safeUrl, isHexColour } from "@/lib/admin-parse";
import { quoteRequest, getLinkRequest } from "@/lib/link-orders";
import { parseItemTypes, saveItemTypes, saveLinkAuto } from "@/lib/link-auto";
import { appUrl } from "@/lib/app-url";
import { enqueueDirect } from "@/lib/notify/outbox";
import { renderQuoteMessage } from "@/lib/notify/templates";
import { deleteShop, deleteZone, updateLinkRequest, upsertMethod, upsertProduct, upsertShop, upsertZone } from "@/lib/admin";
import { parseMinor } from "@/lib/money";
import { setExchangeRate } from "@/lib/fx";
import { staffSetStatus } from "@/lib/orders";
import { serviceFeeSchema, setSetting } from "@/lib/settings";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { kickOutbox } from "@/lib/notify/kick";
import { getSettings } from "@/lib/settings";

function done(path: string, error?: string): never {
  revalidatePath("/", "layout");
  redirect(error ? `${path}?error=${encodeURIComponent(error)}` : `${path}?saved=1`);
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(str(f, k));
const checked = (f: FormData, k: string) => f.get(k) === "on";

/** Money typed as a decimal in the form, e.g. "12.50" -> 1250 minor units. */
function money(f: FormData, k: string, label: string): number | string {
  const v = parseMinor(str(f, k));
  return v === null ? `${label} must be an amount like 12.50.` : v;
}

// ---------------------------------------------------------------- session

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const cfg = adminConfig();
  if (!cfg) return { error: "Admin is not configured. Set ADMIN_PASSWORD and ADMIN_SECRET on the server." };
  const key = await clientKey();
  if (!loginAllowed(key)) return { error: "Too many attempts. Try again in 15 minutes." };
  if (!passwordMatches(String(formData.get("password") ?? ""), cfg.password)) {
    recordLoginFailure(key);
    return { error: "That password is not right." };
  }
  clearLoginFailures(key);
  await startAdminSession();
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await endAdminSession();
  redirect("/admin/login");
}

// ---------------------------------------------------------------- pricing

export async function savePricingAction(f: FormData): Promise<void> {
  await requireAdmin();
  const path = "/admin/pricing";

  const siteName = str(f, "siteName");
  if (siteName.length < 2 || siteName.length > 40) done(path, "The site name must be 2 to 40 characters.");
  const fxRate = num(f, "fxRate");
  if (!Number.isFinite(fxRate) || fxRate <= 0 || fxRate > 1000) done(path, "Enter the exchange rate as GH₵ per £1, for example 15.20.");
  const markup = num(f, "fxMarkup");
  if (!Number.isFinite(markup) || markup < 0 || markup > 50) done(path, "The exchange-rate markup must be between 0 and 50 percent.");
  const minOrder = money(f, "minOrder", "The minimum order");
  if (typeof minOrder === "string") done(path, minOrder);

  const mode = str(f, "feeMode");
  let candidate: unknown;
  if (mode === "percent") {
    const min = money(f, "feeMin", "The minimum service charge");
    if (typeof min === "string") done(path, min);
    candidate = { mode, percent: num(f, "feePercent"), minMinor: min };
  } else if (mode === "fixed") {
    const fixed = money(f, "feeFixed", "The flat service charge");
    if (typeof fixed === "string") done(path, fixed);
    candidate = { mode, fixedMinor: fixed };
  } else if (mode === "tiered") {
    const tiers = parseTiers(str(f, "feeTiers"));
    if (!tiers.ok) done(path, tiers.error);
    const min = money(f, "tierMin", "The minimum service charge");
    if (typeof min === "string") done(path, min);
    candidate = { mode, tiers: tiers.value, minMinor: min };
  } else {
    done(path, "Choose how the service charge is worked out.");
  }
  const fee = serviceFeeSchema.safeParse(candidate);
  if (!fee.success) done(path, "The service charge values are not valid. Percentages must be between 0 and 100.");

  const before = getSettings();
  setSetting("site_name", siteName);
  if (fxRate !== before.fx.rate || markup !== before.fx.markupPct) {
    setExchangeRate(fxRate, markup, "Changed on the Pricing page");
    audit("rate.update", "exchange rate", `GH₵${before.fx.rate} (+${before.fx.markupPct}%) to GH₵${fxRate} (+${markup}%)`);
  }
  setSetting("min_order_gbp_minor", minOrder);
  setSetting("service_fee", fee.data);
  audit("pricing.update", "service charge", JSON.stringify(fee.data).slice(0, 300));
  setSetting("support_whatsapp", str(f, "whatsapp").replace(/[^\d+]/g, "").slice(0, 20));
  done(path);
}

// --------------------------------------------------------------- shipping

export async function saveMethodAction(f: FormData): Promise<void> {
  await requireAdmin();
  const path = "/admin/shipping";
  const id = num(f, "id") || 0;
  const name = str(f, "name");
  if (name.length < 2 || name.length > 40) done(path, "Give the method a name (2 to 40 characters).");
  const brackets = parseBrackets(str(f, "brackets"));
  if (!brackets.ok) done(path, brackets.error);
  const extra = money(f, "extraPerKg", "The charge per extra kg");
  if (typeof extra === "string") done(path, extra);
  const min = money(f, "minCharge", "The minimum charge");
  if (typeof min === "string") done(path, min);
  const res = upsertMethod({
    id, code: "", name, eta: str(f, "eta").slice(0, 80),
    rateCard: { brackets: brackets.value, extraPerKgMinor: extra, minChargeMinor: min },
    active: checked(f, "active"), sort: Math.trunc(num(f, "sort")) || 0,
  });
  if (!res.ok) done(path, res.error);
  audit("shipping.save", name, `${brackets.value.length} bracket(s)`);
  done(path);
}

export async function saveZoneAction(f: FormData): Promise<void> {
  await requireAdmin();
  const path = "/admin/zones";
  const name = str(f, "name");
  if (name.length < 2 || name.length > 60) done(path, "Give the area a name (2 to 60 characters).");
  const fee = money(f, "fee", "The delivery fee");
  if (typeof fee === "string") done(path, fee);
  upsertZone({
    id: num(f, "id") || 0, name, areas: str(f, "areas").slice(0, 200), feeMinor: fee,
    eta: str(f, "eta").slice(0, 60), active: checked(f, "active"), sort: Math.trunc(num(f, "sort")) || 0,
  });
  audit("zone.save", name, `fee ${fee}`);
  done(path);
}

export async function deleteZoneAction(f: FormData): Promise<void> {
  await requireAdmin();
  const path = "/admin/zones";
  if (!checked(f, "confirm")) done(path, "Tick the box to confirm you want to delete this area.");
  const r = deleteZone(num(f, "id"));
  if (!r.ok) done(path, r.error);
  audit("zone.delete", r.name);
  done(path);
}

// ------------------------------------------------------------ shops, items

export async function saveShopAction(f: FormData): Promise<void> {
  await requireAdmin();
  const path = "/admin/shops";
  const name = str(f, "name");
  if (name.length < 2 || name.length > 60) done(path, "Give the shop a name (2 to 60 characters).");
  const category = str(f, "category");
  if (!category || category.length > 40) done(path, "Give the shop a category.");
  const site = safeUrl(str(f, "websiteUrl"));
  if (site === null) done(path, "The shop website must start with https://");
  const accent = str(f, "accent") || "#0b5d3b";
  if (!isHexColour(accent)) done(path, "The shop colour must be a hex colour like #0b5d3b.");
  const shopId = num(f, "id") || 0;
  const rawLogo = str(f, "logoUrl");
  let logo: string | null | undefined = isUploadUrl(rawLogo) ? rawLogo : safeUrl(rawLogo);
  if (logo === null) done(path, "The logo link must start with https://");
  if (logo === "") logo = undefined; // nothing typed: keep what is saved
  const file = f.get("logoFile");
  if (file instanceof File && file.size > 0) {
    const saved = saveImage(Buffer.from(await file.arrayBuffer()));
    if (!saved.ok) done(path, saved.error);
    logo = saved.url;
  }
  if (checked(f, "removeLogo")) logo = "";
  upsertShop({
    id: shopId, logoUrl: logo, name, tagline: str(f, "tagline").slice(0, 80), category, websiteUrl: site,
    description: str(f, "description").slice(0, 400), accent, active: checked(f, "active"),
    sort: Math.trunc(num(f, "sort")) || 0,
  });
  audit("shop.save", name, checked(f, "active") ? "shown" : "hidden");
  done(path);
}

export async function deleteShopAction(f: FormData): Promise<void> {
  await requireAdmin();
  const path = "/admin/shops";
  const id = num(f, "id");
  const name = (db().prepare("SELECT name FROM shops WHERE id = ?").get(id) as { name: string } | undefined)?.name ?? `#${id}`;
  if (!checked(f, "confirm")) done(path, "Tick the box to confirm you want to delete the shop and its items.");
  const r = deleteShop(id);
  if (!r.ok) done(path, r.error);
  audit("shop.delete", name, `with ${r.products} item(s) and ${r.sources} source(s)`);
  done(path);
}

export async function saveProductAction(f: FormData): Promise<void> {
  await requireAdmin();
  const id = num(f, "id") || 0;
  const path = id ? `/admin/items/${id}` : "/admin/items/new";
  const name = str(f, "name");
  if (name.length < 2 || name.length > 120) done(path, "Give the item a name (2 to 120 characters).");
  const shopId = num(f, "shopId");
  if (!db().prepare("SELECT 1 FROM shops WHERE id = ?").get(shopId)) done(path, "Choose a shop.");
  const price = money(f, "price", "The price");
  if (typeof price === "string") done(path, price);
  const weight = Math.trunc(num(f, "weightGrams"));
  if (!Number.isFinite(weight) || weight < 0 || weight > 100000) done(path, "Weight must be in grams, between 0 and 100000.");
  const options = parseOptionGroups(str(f, "options"));
  if (!options.ok) done(path, options.error);
  const wasRaw = str(f, "compareAt");
  let compareAt: number | null = null;
  if (wasRaw) {
    const v = parseMinor(wasRaw);
    if (v === null) done(path, "The was price must be an amount like 79.99.");
    if (v <= price) done(path, "The was price must be higher than the price, or leave it empty for no deal.");
    compareAt = v;
  }
  const endsRaw = str(f, "dealEnds");
  let dealEnds: string | null = null;
  if (endsRaw) {
    if (!compareAt) done(path, "Add a was price to run a deal with an end time.");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(endsRaw) || Number.isNaN(Date.parse(`${endsRaw}:00Z`))) done(path, "Enter the end of the deal as a date and time.");
    dealEnds = `${endsRaw.replace("T", " ")}:00`;
  }
  const rawImage = str(f, "imageUrl");
  let image = isUploadUrl(rawImage) ? rawImage : safeUrl(rawImage);
  const source = safeUrl(str(f, "sourceUrl"));
  if (image === null || source === null) done(path, "Links must start with https://");
  const file = f.get("imageFile");
  if (file instanceof File && file.size > 0) {
    const saved = saveImage(Buffer.from(await file.arrayBuffer()));
    if (!saved.ok) done(path, saved.error);
    image = saved.url;
  }
  if (checked(f, "removeImage")) image = "";
  const savedId = upsertProduct({
    id, shopId, name, brand: str(f, "brand").slice(0, 60), category: str(f, "category").slice(0, 40),
    description: str(f, "description").slice(0, 2000), priceMinor: price, weightGrams: weight,
    options: options.value, imageUrl: image, sourceUrl: source, active: checked(f, "active"),
    compareAtMinor: compareAt, dealEndsAt: dealEnds,
  });
  audit("item.save", name, `price ${price}${checked(f, "active") ? "" : ", hidden"}`);
  revalidatePath("/", "layout");
  redirect(`/admin/items/${savedId}?saved=1`);
}

// ----------------------------------------------------------------- orders

const statusSchema = z.object({ orderId: z.coerce.number().int().positive(), status: z.string(), note: z.string().max(500) });

export async function setOrderStatusAction(f: FormData): Promise<void> {
  await requireAdmin();
  const parsed = statusSchema.safeParse({ orderId: f.get("orderId"), status: f.get("status"), note: str(f, "note") });
  if (!parsed.success) redirect("/admin/orders");
  const path = `/admin/orders/${parsed.data.orderId}`;
  const res = staffSetStatus(parsed.data.orderId, parsed.data.status, parsed.data.note);
  if (res.ok) {
    audit("order.status", `order ${parsed.data.orderId}`, parsed.data.status);
    kickOutbox();
  }
  done(path, res.ok ? undefined : res.error);
}

/** Saves how link requests are priced automatically, and the item types with their default weights. */
export async function saveLinkAutoAction(f: FormData): Promise<void> {
  await requireAdmin();
  const path = "/admin/requests";
  const margin = num(f, "marginPct");
  if (!Number.isFinite(margin) || margin < 0 || margin > 50) done(path, "The safety margin must be between 0 and 50 percent.");
  const ceiling = money(f, "ceiling", "The automatic limit");
  if (typeof ceiling === "string") done(path, ceiling);
  if (ceiling < 1000) done(path, "The automatic limit must be at least £10.");
  const days = num(f, "validDays");
  if (!Number.isFinite(days) || days < 1 || days > 30) done(path, "Hold quotes for between 1 and 30 days.");
  const types = parseItemTypes(String(f.get("itemTypes") ?? ""));
  if (!types.ok) done(path, types.error);
  const saved = saveLinkAuto({ pageEnabled: checked(f, "pageEnabled"), customerEnabled: checked(f, "customerEnabled"), marginPct: margin, ceilingMinor: ceiling, validDays: days });
  saveItemTypes(types.value);
  audit("request.auto_settings", "automatic quotes", `page ${saved.pageEnabled ? "on" : "off"}, customer price ${saved.customerEnabled ? "on" : "off"}, margin ${saved.marginPct}%, limit £${(saved.ceilingMinor / 100).toFixed(0)}`);
  done(path);
}

/** Records the UK price the team checked, opens the customer's pay link and tells the customer. */
export async function quoteRequestAction(f: FormData): Promise<void> {
  await requireAdmin();
  const id = num(f, "id");
  const price = money(f, "unitPrice", "The UK price");
  if (typeof price === "string") done("/admin/requests", price);
  const validDays = Math.round(num(f, "validDays")) || 3;
  const r = quoteRequest(id, { unitPriceMinor: price, weightGrams: Math.round(num(f, "weight")) || 500, validDays, note: str(f, "quoteNote") });
  if (!r.ok) done("/admin/requests", r.error);
  const req = getLinkRequest(id)!;
  const base = appUrl();
  let sent = "";
  if (base && f.get("notify") === "on") {
    const rendered = renderQuoteMessage(getSettings().siteName, req.name, req.title || req.url, `${base}/quote/${r.token}`, validDays);
    sent = enqueueDirect({ phone: req.phone, email: req.email }, rendered, "link_quote") ?? "";
    if (sent) kickOutbox();
  }
  audit("request.quote", `request ${id}`, `£${(price / 100).toFixed(2)} each${sent ? `, sent by ${sent}` : ", not sent"}`);
  revalidatePath("/", "layout");
  redirect(`/admin/requests?quoted=${id}&via=${encodeURIComponent(sent)}`);
}

export async function updateRequestAction(f: FormData): Promise<void> {
  await requireAdmin();
  updateLinkRequest(num(f, "id"), str(f, "status"), str(f, "adminNote"));
  audit("request.update", `request ${num(f, "id")}`, str(f, "status"));
  done("/admin/requests");
}
