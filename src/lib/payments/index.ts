import type Database from "better-sqlite3";
import { db } from "../db";
import { activePaymentProviders, getIntegration, isConfigured, readConfig, type ProviderId } from "../integrations";
import { makeFlutterwave } from "./flutterwave";
import { makePaystack } from "./paystack";
import { makeStripe } from "./stripe";
import type { Currency, PaymentGateway } from "./types";

type Db = Database.Database;

export type { PaymentGateway } from "./types";

/** Build a gateway from saved configuration, whether or not it is switched on. Null if keys are missing. */
export function buildGateway(id: ProviderId, d: Db = db(), env: NodeJS.ProcessEnv = process.env): PaymentGateway | null {
  const def = getIntegration(id);
  if (!def) return null;
  const cfg = readConfig(def, d, env);
  if (!isConfigured(def, cfg, "payments")) return null;
  const v = cfg.values;
  switch (id) {
    case "stripe":
      return makeStripe({ secretKey: v.secretKey, webhookSecret: v.webhookSecret, chargeCurrency: (v.chargeCurrency === "GHS" ? "GHS" : "GBP") as Currency });
    case "paystack":
      return makePaystack({ secretKey: v.secretKey });
    case "flutterwave":
      return makeFlutterwave({ secretKey: v.secretKey, secretHash: v.secretHash });
    default:
      return null;
  }
}

/** Gateways customers can use right now: configured and switched on. */
export function activeGateways(d: Db = db(), env: NodeJS.ProcessEnv = process.env): PaymentGateway[] {
  return activePaymentProviders(d, env)
    .map(({ def }) => buildGateway(def.id, d, env))
    .filter((g): g is PaymentGateway => g !== null);
}

export function activeGateway(id: string, d: Db = db(), env: NodeJS.ProcessEnv = process.env): PaymentGateway | null {
  return activeGateways(d, env).find((g) => g.id === id) ?? null;
}

/** Demo payments move no money. Allowed in development, or in production only when explicitly enabled. */
export function demoPaymentsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" || env.ALLOW_DEMO_PAYMENTS === "true";
}
