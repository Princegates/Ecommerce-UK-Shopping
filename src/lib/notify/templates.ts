import { ghs } from "../money";
import { STATUS_HELP, STATUS_LABEL, type OrderStatus } from "../order-status";
import type { EmailContent, TemplateVars } from "./senders";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export type OrderMessageInput = {
  siteName: string;
  customerName: string;
  orderNumber: string;
  totalMinor: number;
  link: string | null;
  status: OrderStatus;
};

export type Rendered = { sms: string; whatsappText: string; vars: TemplateVars; email: EmailContent };

export function renderOrderMessage(i: OrderMessageInput): Rendered {
  const label = STATUS_LABEL[i.status];
  const help = STATUS_HELP[i.status];
  const first = i.customerName.split(/\s+/)[0] || "there";
  const tail = i.link ? ` Track: ${i.link}` : "";
  const paid = i.status === "PAID" ? ` We received ${ghs(i.totalMinor)}.` : "";

  const sms = `${i.siteName}: order ${i.orderNumber} - ${label}.${paid}${tail}`;
  const update = `${label}.${paid}${tail}`.trim();
  const vars: TemplateVars = { name: first, orderNumber: i.orderNumber, update };
  const whatsappText = `Hi ${first}, ${i.siteName} order ${i.orderNumber}: ${label}.${paid} ${help}${tail}`;

  const subject = `${i.siteName}: order ${i.orderNumber} - ${label}`;
  const text = [`Hi ${first},`, "", `${label}.${paid}`, help, "", i.link ? `Track your order: ${i.link}` : "", "", `Order ${i.orderNumber}`, `Total ${ghs(i.totalMinor)}`, "", `${i.siteName}`]
    .filter((l, idx, a) => !(l === "" && a[idx - 1] === ""))
    .join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f5eddd;font-family:Arial,Helvetica,sans-serif;color:#1b1712">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf6;border:2px solid #1b1712">
<tr><td style="padding:20px 24px;background:#1b1712;color:#f5eddd;font-size:20px;font-weight:bold">${esc(i.siteName)}</td></tr>
<tr><td style="padding:24px"><p style="margin:0 0 8px">Hi ${esc(first)},</p>
<h1 style="margin:0 0 8px;font-size:24px">${esc(label)}</h1>
<p style="margin:0 0 16px">${esc(paid.trim())} ${esc(help)}</p>
${i.link ? `<p style="margin:0 0 20px"><a href="${esc(i.link)}" style="display:inline-block;padding:12px 18px;background:#0b5d3b;color:#f5eddd;text-decoration:none;font-weight:bold;border:2px solid #1b1712">Track your order</a></p>` : ""}
<p style="margin:0;color:#5a5143;font-size:13px">Order ${esc(i.orderNumber)} &middot; Total ${esc(ghs(i.totalMinor))}</p>
</td></tr></table></td></tr></table></body></html>`;
  return { sms, whatsappText, vars, email: { subject, text, html } };
}

/** Tells a customer their link request has been checked and can be paid for. */
export function renderQuoteMessage(siteName: string, customerName: string, item: string, link: string, validDays: number): Rendered {
  const first = customerName.split(/\s+/)[0] || "there";
  const title = item.length > 60 ? `${item.slice(0, 57)}...` : item;
  const sms = `${siteName}: your price for "${title}" is ready. See the full cost in cedis and pay (valid ${validDays} days): ${link}`;
  const text = `Hi ${first},\n\nWe checked "${item}" and your price is ready. Open the link to see the full cost in cedis, choose delivery and pay. The price is held for ${validDays} days.\n\n${link}\n\n${siteName}`;
  const html = `<p>Hi ${esc(first)},</p><p>We checked <strong>${esc(item)}</strong> and your price is ready. See the full cost in cedis, choose delivery and pay. The price is held for ${validDays} days.</p><p><a href="${esc(link)}">See your price and pay</a></p><p>${esc(siteName)}</p>`;
  return {
    sms, whatsappText: sms, vars: { name: first, orderNumber: "", update: sms },
    email: { subject: `${siteName}: your price is ready`, text, html },
  };
}

export function renderResetMessage(siteName: string, link: string, minutes: number): Rendered {
  const sms = `${siteName}: reset your password within ${minutes} minutes: ${link}`;
  const text = `Someone asked to reset the password for your ${siteName} account.\n\nReset it here (valid for ${minutes} minutes): ${link}\n\nIf this was not you, ignore this message. Your password stays the same.`;
  const html = `<p>Someone asked to reset the password for your ${esc(siteName)} account.</p><p><a href="${esc(link)}">Reset your password</a> (valid for ${minutes} minutes).</p><p>If this was not you, ignore this message. Your password stays the same.</p>`;
  return {
    sms,
    whatsappText: sms,
    vars: { name: "", orderNumber: "", update: sms },
    email: { subject: `${siteName}: reset your password`, text, html },
  };
}

export function renderTestMessage(siteName: string): Rendered {
  const text = `This is a test message from ${siteName}. If you can read this, the connection works.`;
  return {
    sms: text,
    whatsappText: text,
    vars: { name: "Admin", orderNumber: "TEST", update: "Test message, no action needed" },
    email: { subject: `${siteName}: test message`, text, html: `<p>${esc(text)}</p>` },
  };
}
