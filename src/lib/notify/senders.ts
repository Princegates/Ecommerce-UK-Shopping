import { digitsOnly } from "./phone";

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };
export type FetchLike = typeof fetch;

export type TemplateVars = { name: string; orderNumber: string; update: string };

const TIMEOUT = 15_000;

async function readJson(res: Response): Promise<Record<string, any>> {
  return (await res.json().catch(() => ({}))) as Record<string, any>;
}

const fail = (provider: string, status: number, detail?: unknown): SendResult => ({
  ok: false,
  error: `${provider} answered HTTP ${status}${typeof detail === "string" && detail ? `: ${detail.slice(0, 160)}` : ""}`,
});

// ---------------------------------------------------------------------- SMS

export async function sendArkesel(
  cfg: { apiKey: string; senderId: string },
  to: string,
  body: string,
  f: FetchLike = fetch,
): Promise<SendResult> {
  const res = await f("https://sms.arkesel.com/api/v2/sms/send", {
    method: "POST",
    headers: { "api-key": cfg.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ sender: cfg.senderId, message: body, recipients: [digitsOnly(to)] }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const j = await readJson(res);
  if (res.ok && j.status === "success") return { ok: true };
  return fail("Arkesel", res.status, j.message);
}

type TwilioCfg = {
  accountSid: string;
  authToken: string;
  smsFrom?: string;
  whatsappFrom?: string;
  whatsappContentSid?: string;
};

async function twilioSend(cfg: TwilioCfg, params: Record<string, string>, f: FetchLike): Promise<SendResult> {
  const res = await f(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const j = await readJson(res);
  if (res.ok && typeof j.sid === "string") return { ok: true, id: j.sid };
  return fail("Twilio", res.status, j.message);
}

export function twilioSms(cfg: TwilioCfg, to: string, body: string, f: FetchLike = fetch): Promise<SendResult> {
  const from = cfg.smsFrom ?? "";
  const params: Record<string, string> = { To: to, Body: body };
  if (from.startsWith("MG")) params.MessagingServiceSid = from;
  else params.From = from;
  return twilioSend(cfg, params, f);
}

export function twilioWhatsapp(cfg: TwilioCfg, to: string, text: string, vars: TemplateVars, f: FetchLike = fetch): Promise<SendResult> {
  const from = `whatsapp:${cfg.whatsappFrom ?? ""}`;
  const dest = `whatsapp:${to}`;
  if (cfg.whatsappContentSid) {
    return twilioSend(
      cfg,
      { To: dest, From: from, ContentSid: cfg.whatsappContentSid, ContentVariables: JSON.stringify({ "1": vars.name, "2": vars.orderNumber, "3": vars.update }) },
      f,
    );
  }
  return twilioSend(cfg, { To: dest, From: from, Body: text }, f);
}

// ----------------------------------------------------------------- WhatsApp

export async function sendMetaWhatsapp(
  cfg: { accessToken: string; phoneNumberId: string; templateName: string; templateLanguage: string; graphVersion: string },
  to: string,
  vars: TemplateVars,
  f: FetchLike = fetch,
): Promise<SendResult> {
  const res = await f(
    `https://graph.facebook.com/${encodeURIComponent(cfg.graphVersion)}/${encodeURIComponent(cfg.phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: digitsOnly(to),
        type: "template",
        template: {
          name: cfg.templateName,
          language: { code: cfg.templateLanguage },
          components: [
            {
              type: "body",
              parameters: [vars.name, vars.orderNumber, vars.update].map((text) => ({ type: "text", text: text.replace(/[\r\n\t]+/g, " ").slice(0, 900) })),
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    },
  );
  const j = await readJson(res);
  if (res.ok && Array.isArray(j.messages)) return { ok: true, id: j.messages[0]?.id };
  return fail("WhatsApp", res.status, j.error?.message);
}

// -------------------------------------------------------------------- Email

export type EmailContent = { subject: string; text: string; html: string };

export async function sendResend(
  cfg: { apiKey: string; from: string },
  to: string,
  mail: EmailContent,
  f: FetchLike = fetch,
): Promise<SendResult> {
  const res = await f("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: cfg.from, to: [to], subject: mail.subject, text: mail.text, html: mail.html }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const j = await readJson(res);
  if (res.ok && typeof j.id === "string") return { ok: true, id: j.id };
  return fail("Resend", res.status, j.message);
}

export async function sendPostmark(
  cfg: { serverToken: string; from: string; messageStream: string },
  to: string,
  mail: EmailContent,
  f: FetchLike = fetch,
): Promise<SendResult> {
  const res = await f("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: { "X-Postmark-Server-Token": cfg.serverToken, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      From: cfg.from, To: to, Subject: mail.subject, TextBody: mail.text, HtmlBody: mail.html, MessageStream: cfg.messageStream,
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const j = await readJson(res);
  if (res.ok && j.ErrorCode === 0) return { ok: true, id: j.MessageID };
  return fail("Postmark", res.status, j.Message);
}
