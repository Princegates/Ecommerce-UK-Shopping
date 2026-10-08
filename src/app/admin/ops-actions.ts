"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { createResetToken, getCustomerById, setCustomerStatus } from "@/lib/customers";
import { appUrl } from "@/lib/app-url";
import { setExchangeRate } from "@/lib/fx";
import { applyMarketRate, getFxPolicy, refreshMarketRate, saveFxPolicy, testRateProvider, type FxMode } from "@/lib/fx-api";
import {
  clearField, getIntegration, providersFor, saveFields, setChannelProvider, setEnabled, type Channel, type ProviderId,
} from "@/lib/integrations";
import { EMPTY_COSTS, saveCosts } from "@/lib/margin";
import { parseMinor } from "@/lib/money";
import { kickOutbox } from "@/lib/notify/kick";
import {
  MESSAGE_CHANNELS, getRules, processOutbox, retryMessage, saveRules, sendTest, type MessageChannel,
} from "@/lib/notify/outbox";
import { addTracking, deleteTracking } from "@/lib/orders";
import { setReviewStatus } from "@/lib/reviews";
import { ORDER_STATUSES } from "@/lib/order-status";
import { buildGateway } from "@/lib/payments";
import { diffbotConfig, diffbotProduct } from "@/lib/ingest/diffbot";
import { ebayConfig, ebayToken } from "@/lib/ingest/ebay";
import { getSettings, setSetting } from "@/lib/settings";
import { THEMES } from "@/lib/themes";
import { db } from "@/lib/db";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(str(f, k));

function back(path: string, params: Record<string, string>, hash = ""): never {
  revalidatePath("/", "layout");
  const q = new URLSearchParams(params).toString();
  redirect(`${path}${q ? `?${q}` : ""}${hash}`);
}

// ------------------------------------------------------------ exchange rate

const RATE_RETURN = new Set(["/admin", "/admin/pricing"]);

export async function setRateAction(f: FormData): Promise<void> {
  const who = await requirePermission("pricing.manage");
  const to = RATE_RETURN.has(str(f, "returnTo")) ? str(f, "returnTo") : "/admin";
  const before = getSettings().fx;
  const rate = num(f, "fxRate");
  const markup = num(f, "fxMarkup");
  const res = setExchangeRate(rate, markup, str(f, "note"));
  if (!res.ok) back(to, { error: res.error }, "#rate");
  adminAudit(who, "rate.update", "exchange rate", `GH₵${before.rate} (+${before.markupPct}%) to GH₵${rate} (+${markup}%)`);
  back(to, { saved: "rate" }, "#rate");
}

// ------------------------------------------------------------- integrations

export async function saveIntegrationAction(f: FormData): Promise<void> {
  const who = await requirePermission("integrations.manage");
  const def = getIntegration(str(f, "provider"));
  if (!def) back("/admin/integrations", { error: "Unknown integration." });
  const submitted: Record<string, string> = {};
  for (const field of def.fields) if (f.has(field.key)) submitted[field.key] = String(f.get(field.key) ?? "");
  const res = saveFields(def, submitted);
  const hash = `#${def.id}`;
  if (!res.ok) back("/admin/integrations", { error: res.error, p: def.id }, hash);
  adminAudit(who, "integration.save", def.name, `${res.changed} field(s) updated`);
  back("/admin/integrations", { saved: def.id }, hash);
}

export async function clearFieldAction(f: FormData): Promise<void> {
  const who = await requirePermission("integrations.manage");
  const def = getIntegration(str(f, "provider"));
  if (!def) back("/admin/integrations", { error: "Unknown integration." });
  clearField(def, str(f, "key"));
  adminAudit(who, "integration.clear", def.name, `${str(f, "key")} removed`);
  back("/admin/integrations", { saved: def.id }, `#${def.id}`);
}

export async function toggleIntegrationAction(f: FormData): Promise<void> {
  const who = await requirePermission("integrations.manage");
  const def = getIntegration(str(f, "provider"));
  if (!def) back("/admin/integrations", { error: "Unknown integration." });
  const on = str(f, "enabled") === "1";
  setEnabled(def, on);
  adminAudit(who, on ? "integration.enable" : "integration.disable", def.name);
  back("/admin/integrations", { saved: def.id }, `#${def.id}`);
}

export async function setChannelAction(f: FormData): Promise<void> {
  const who = await requirePermission("integrations.manage");
  const channel = str(f, "channel") as Channel;
  if (channel !== "rates" && !MESSAGE_CHANNELS.includes(channel as MessageChannel)) back("/admin/integrations", { error: "Unknown channel." });
  const id = str(f, "provider");
  if (!setChannelProvider(channel, id as ProviderId | "")) back("/admin/integrations", { error: "That provider does not support this channel." });
  adminAudit(who, "channel.set", channel, id || "none");
  back("/admin/integrations", { saved: `channel-${channel}` }, channel === "rates" ? "#rates-feed" : "#channels");
}

export async function testIntegrationAction(f: FormData): Promise<void> {
  const who = await requirePermission("integrations.manage");
  const def = getIntegration(str(f, "provider"));
  if (!def) back("/admin/integrations", { error: "Unknown integration." });
  const hash = `#${def.id}`;
  const channel = str(f, "channel") as Channel;

  if (channel === "payments") {
    const gateway = buildGateway(def.id);
    if (!gateway) back("/admin/integrations", { test: "fail", p: def.id, msg: "Save all the required fields first." }, hash);
    let result: { ok: boolean; message: string };
    try {
      result = await gateway.ping();
    } catch {
      result = { ok: false, message: "Could not reach the provider." };
    }
    adminAudit(who, "integration.test", def.name, result.ok ? "ok" : "failed");
    back("/admin/integrations", { test: result.ok ? "ok" : "fail", p: def.id, msg: result.message }, hash);
  }

  if (channel === "catalog" && def.id === "diffbot") {
    const cfg = diffbotConfig();
    if (!cfg) back("/admin/integrations", { test: "fail", p: def.id, msg: "Save the token first, and switch Diffbot on." }, hash);
    let result: { ok: boolean; message: string };
    try {
      // a real call with a harmless public page: it checks the token without needing a product (a page with no product is fine)
      await diffbotProduct(cfg, "https://example.com/");
      result = { ok: true, message: "Diffbot accepted the token." };
    } catch (e) {
      result = { ok: false, message: e instanceof Error ? e.message : "Could not reach Diffbot." };
    }
    adminAudit(who, "integration.test", def.name, result.ok ? "ok" : "failed");
    back("/admin/integrations", { test: result.ok ? "ok" : "fail", p: def.id, msg: result.message }, hash);
  }

  if (channel === "catalog") {
    const cfg = ebayConfig();
    if (!cfg) back("/admin/integrations", { test: "fail", p: def.id, msg: "Save the App ID and Cert ID first, and switch eBay on." }, hash);
    let result: { ok: boolean; message: string };
    try {
      await ebayToken(cfg);
      result = { ok: true, message: `eBay accepted the keys (${cfg.environment}).` };
    } catch (e) {
      result = { ok: false, message: e instanceof Error ? e.message : "Could not reach eBay." };
    }
    adminAudit(who, "integration.test", def.name, result.ok ? "ok" : "failed");
    back("/admin/integrations", { test: result.ok ? "ok" : "fail", p: def.id, msg: result.message }, hash);
  }

  if (channel === "rates") {
    const r = await testRateProvider(def.id);
    adminAudit(who, "integration.test", def.name, r.ok ? "ok" : "failed");
    back("/admin/integrations", { test: r.ok ? "ok" : "fail", p: def.id, msg: r.message }, hash);
  }

  if (!providersFor(channel).some((p) => p.id === def.id)) back("/admin/integrations", { test: "fail", p: def.id, msg: "Choose a channel to test." }, hash);
  const to = str(f, "to");
  if (!to) back("/admin/integrations", { test: "fail", p: def.id, msg: "Enter where to send the test message." }, hash);
  const res = await sendTest(def.id, channel as MessageChannel, to);
  adminAudit(who, "integration.test", def.name, `${channel}: ${res.ok ? "sent" : "failed"}`);
  back("/admin/integrations", { test: res.ok ? "ok" : "fail", p: def.id, msg: res.ok ? `Test ${channel} message sent. Check the device.` : res.error }, hash);
}

export async function saveNotifyRulesAction(f: FormData): Promise<void> {
  const who = await requirePermission("messages.manage");
  const rules = getRules();
  for (const s of ORDER_STATUSES) for (const c of MESSAGE_CHANNELS) rules[s][c] = f.get(`rule:${s}:${c}`) === "on";
  saveRules(rules);
  adminAudit(who, "notify.rules", "notifications", "rules updated");
  back("/admin/integrations", { saved: "rules" }, "#rules");
}

// ------------------------------------------------------------------ messages

export async function retryMessageAction(f: FormData): Promise<void> {
  await requirePermission("messages.manage");
  retryMessage(num(f, "id"));
  kickOutbox();
  back("/admin/messages", { saved: "1" });
}

export async function sendQueuedNowAction(): Promise<void> {
  const who = await requirePermission("messages.manage");
  const r = await processOutbox();
  adminAudit(who, "messages.send", "outbox", `${r.sent} sent, ${r.failed} failed, ${r.retrying} retrying`);
  back("/admin/messages", { ran: `${r.sent} sent, ${r.failed} failed, ${r.retrying} to retry` });
}

// ------------------------------------------------------ order tracking, costs

export async function addTrackingAction(f: FormData): Promise<void> {
  const who = await requirePermission("orders.manage");
  const orderId = num(f, "orderId");
  const path = `/admin/orders/${orderId}`;
  const res = addTracking(orderId, { stage: str(f, "stage"), carrier: str(f, "carrier"), reference: str(f, "reference"), url: str(f, "url"), note: str(f, "note") });
  if (!res.ok) back(path, { error: res.error }, "#tracking");
  adminAudit(who, "order.tracking", `order ${orderId}`, `${str(f, "stage")} ${str(f, "reference")}`.trim());
  back(path, { saved: "tracking" }, "#tracking");
}

export async function deleteTrackingAction(f: FormData): Promise<void> {
  const who = await requirePermission("orders.manage");
  const orderId = num(f, "orderId");
  deleteTracking(orderId, num(f, "trackingId"));
  adminAudit(who, "order.tracking.delete", `order ${orderId}`);
  back(`/admin/orders/${orderId}`, { saved: "tracking" }, "#tracking");
}

export async function saveCostsAction(f: FormData): Promise<void> {
  const who = await requirePermission("orders.costs");
  const orderId = num(f, "orderId");
  const path = `/admin/orders/${orderId}`;
  const amount = (k: string, label: string): number => {
    const raw = str(f, k);
    if (raw === "") return 0;
    const v = parseMinor(raw);
    if (v === null) back(path, { error: `${label} must be an amount like 12.50.` }, "#costs");
    return v;
  };
  const rate = str(f, "purchaseRate") === "" ? 0 : num(f, "purchaseRate");
  if (!Number.isFinite(rate) || rate < 0 || rate > 1000) back(path, { error: "The rate you bought at must be GH₵ per £1, for example 15.40." }, "#costs");
  saveCosts(orderId, {
    ...EMPTY_COSTS,
    retailerGbpMinor: amount("retailerGbp", "The shop price"),
    ukDeliveryGbpMinor: amount("ukDeliveryGbp", "The UK delivery cost"),
    purchaseRate: rate,
    freightGhsMinor: amount("freightGhs", "The freight cost"),
    localDeliveryGhsMinor: amount("localDeliveryGhs", "The Ghana delivery cost"),
    paymentFeesGhsMinor: amount("paymentFeesGhs", "The payment fees"),
    otherGhsMinor: amount("otherGhs", "Other costs"),
    note: str(f, "note"),
  });
  adminAudit(who, "order.costs", `order ${orderId}`, "costs updated");
  back(path, { saved: "costs" }, "#costs");
}

// ----------------------------------------------------------------- customers

export async function setCustomerStatusAction(f: FormData): Promise<void> {
  const who = await requirePermission("customers.manage");
  const id = num(f, "id");
  const status = str(f, "status") === "DISABLED" ? "DISABLED" : "ACTIVE";
  if (!getCustomerById(id)) back("/admin/customers", { error: "Customer not found." });
  setCustomerStatus(id, status);
  adminAudit(who, status === "DISABLED" ? "customer.disable" : "customer.enable", `customer ${id}`);
  back(`/admin/customers/${id}`, { saved: "status" });
}

export type ResetLinkState = { link?: string; error?: string };

/** Creates a reset link for the admin to pass to the customer by hand, for when no message provider is set up. */
export async function generateResetLinkAction(_prev: ResetLinkState, f: FormData): Promise<ResetLinkState> {
  const who = await requirePermission("customers.manage");
  const id = num(f, "id");
  const c = getCustomerById(id);
  if (!c || c.status !== "ACTIVE") return { error: "That account is not active." };
  const base = appUrl();
  if (!base) return { error: "Set APP_URL on the server first." };
  const token = createResetToken(id);
  adminAudit(who, "customer.reset-link", `customer ${id}`, "reset link generated");
  return { link: `${base}/reset-password/${token}` };
}

// ------------------------------------------------------- market exchange rate

const MARKET_RETURN = new Set(["/admin", "/admin/integrations"]);
const marketReturn = (f: FormData) => (MARKET_RETURN.has(str(f, "returnTo")) ? str(f, "returnTo") : "/admin");

export async function refreshMarketRateAction(f: FormData): Promise<void> {
  const who = await requirePermission("pricing.manage");
  const to = marketReturn(f);
  const r = await refreshMarketRate();
  if (!r.ok) back(to, { error: r.error }, "#rate");
  const a = applyMarketRate(db(), false);
  adminAudit(who, "rate.refresh", "market rate", `GH₵${r.rate} from ${r.provider}${a.applied ? ", applied automatically" : ""}`);
  back(to, { saved: a.applied ? "rate" : "market" }, "#rate");
}

export async function applyMarketRateAction(f: FormData): Promise<void> {
  await requirePermission("pricing.manage");
  const to = marketReturn(f);
  const r = applyMarketRate(db(), true);
  if (!r.applied) back(to, { error: r.reason }, "#rate");
  back(to, { saved: "rate" }, "#rate");
}

export async function saveFxPolicyAction(f: FormData): Promise<void> {
  const who = await requirePermission("pricing.manage");
  const mode = str(f, "mode") as FxMode;
  const res = saveFxPolicy({ mode, maxChangePct: num(f, "maxChangePct"), alertPct: num(f, "alertPct") });
  if (!res.ok) back("/admin/integrations", { error: res.error }, "#rates-feed");
  const p = getFxPolicy();
  adminAudit(who, "rate.policy", "exchange rate feed", `${p.mode}, limit ${p.maxChangePct}%, alert ${p.alertPct}%`);
  back("/admin/integrations", { saved: "fx-policy" }, "#rates-feed");
}

// ------------------------------------------------------------------- reviews

export async function setReviewStatusAction(f: FormData): Promise<void> {
  const who = await requirePermission("reviews.manage");
  const id = num(f, "id");
  const status = str(f, "status") === "HIDDEN" ? "HIDDEN" : "PUBLISHED";
  if (Number.isInteger(id) && setReviewStatus(id, status)) adminAudit(who, `review.${status.toLowerCase()}`, `review #${id}`);
  back("/admin/reviews", { saved: "1" });
}

// ---------------------------------------------------------------- appearance

export async function setThemeAction(f: FormData): Promise<void> {
  const who = await requirePermission("appearance.manage");
  const id = str(f, "theme");
  const theme = THEMES.find((t) => t.id === id);
  if (!theme) back("/admin/appearance", { error: "Choose one of the themes." });
  setSetting("theme", theme.id);
  adminAudit(who, "theme.set", theme.name);
  back("/admin/appearance", { saved: "1" });
}
