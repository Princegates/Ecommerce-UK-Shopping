import type { ReactNode } from "react";
import { appUrl } from "@/lib/app-url";
import { getSettings } from "@/lib/settings";

/** When the policy texts were last changed. Update it whenever the wording of a policy changes. */
export const LEGAL_UPDATED = "8 October 2026";

/** Who the policies speak for, taken from the Site settings so nothing about the business is written into the text. */
export function legalIdentity() {
  const s = getSettings();
  const wa = s.supportWhatsapp.replace(/\D/g, "");
  return {
    brand: s.siteName,
    operator: s.legalName.trim() || s.siteName,
    email: s.supportEmail.trim(),
    whatsapp: wa ? `+${wa}` : "",
    site: appUrl() ?? "this website",
  };
}

/** How to reach us, in words, using only the contact details the owner has filled in. */
export function ContactLine() {
  const { email, whatsapp } = legalIdentity();
  const ways = [email ? <a key="e" className="link" href={`mailto:${email}`}>{email}</a> : null, whatsapp ? <span key="w">WhatsApp {whatsapp}</span> : null].filter(Boolean);
  if (ways.length === 0) return <>the contact details shown on this website</>;
  return <>{ways.flatMap((w, i) => (i === 0 ? [w] : [" or ", w]))}</>;
}

export default function LegalPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 [&_h2]:mt-10 [&_h2]:text-2xl [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6">
      <p className="label">Legal</p>
      <h1 className="text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-ink-soft">Last updated {LEGAL_UPDATED}</p>
      {intro && <p className="mt-5 text-lg">{intro}</p>}
      {children}
    </article>
  );
}
