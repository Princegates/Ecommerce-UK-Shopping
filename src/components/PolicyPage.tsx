import Link from "next/link";
import type { ReactNode } from "react";
import LegalPage, { legalIdentity } from "@/components/LegalPage";
import { COMPANY, POLICIES, POLICY_EFFECTIVE, privacyIntro, type Clause, type Policy } from "@/lib/policies";
import { getSettings } from "@/lib/settings";

/** The customer policies that have their own page, in the pack's order. */
export const POLICY_LINKS: { href: string; label: string; no: number }[] = [
  { no: 1, href: "/terms", label: "Terms and Conditions of Service" },
  ...POLICIES.filter((p) => p.no !== 1 && p.no !== 9).map((p) => ({ no: p.no, href: `/policies/${p.slug}`, label: p.title })),
  { no: 9, href: "/privacy", label: "Privacy Policy" },
  { no: 13, href: "/cookies", label: "Cookie Policy" },
].sort((a, b) => a.no - b.no);

function Rich({ text, email }: { text: string; email: string }) {
  const t = text.replaceAll(COMPANY.email, email);
  const parts = t.split(new RegExp(`(${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`));
  return <>{parts.map((p, i) => (p === email ? <a key={i} className="link" href={`mailto:${email}`}>{email}</a> : p))}</>;
}

function ClauseView({ cl, email }: { cl: Clause; email: string }) {
  return (
    <div className="mt-4">
      <p>
        <span className="font-semibold">{cl.n}</span>{" "}
        {cl.head && <strong>{cl.head}</strong>}{cl.head && cl.text ? " " : ""}
        {cl.text && <Rich text={cl.text} email={email} />}
      </p>
      {cl.items && <ul>{cl.items.map((it) => <li key={it}>{it}</li>)}</ul>}
      {cl.table && (
        <div className="mt-3 overflow-x-auto">
          <table className="table">
            <thead><tr>{cl.table.cols.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{cl.table.rows.map((r) => <tr key={r.join("|")}>{r.map((x, i) => <td key={i}>{x}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Where to go next: every policy, so a customer can find the one that applies. */
export function OtherPolicies({ current }: { current?: number }) {
  return (
    <nav aria-label="All policies" className="box mt-12 p-5">
      <p className="font-bold">All our policies</p>
      <ul className="!mt-2 !list-none !pl-0 text-sm">
        {POLICY_LINKS.map((l) => (
          <li key={l.href}>{l.no === current ? <span className="font-semibold">Policy {l.no}. {l.label}</span> : <Link className="link" href={l.href}>Policy {l.no}. {l.label}</Link>}</li>
        ))}
        <li><Link className="link" href="/data-deletion">Delete your data</Link></li>
        <li><Link className="link" href="/restricted-items">Items we cannot ship</Link></li>
      </ul>
    </nav>
  );
}

export default function PolicyPage({ policy, after }: { policy: Policy; after?: ReactNode }) {
  const s = getSettings();
  const email = s.supportEmail.trim() || COMPANY.email;
  const { brand } = legalIdentity();
  const clauses = policy.no === 9 ? [privacyIntro({ dpcRegNo: s.dpcRegNo.trim(), icoRegNo: s.icoRegNo.trim(), email }), ...policy.clauses] : policy.clauses;
  return (
    <LegalPage title={`${policy.no === 1 ? "" : `${policy.no}. `}${policy.title}`} effective={POLICY_EFFECTIVE} intro={policy.intro ? <>{policy.intro.replace("YenkoExpress", brand)}</> : undefined}>
      {clauses.map((cl) => <ClauseView key={cl.n} cl={cl} email={email} />)}
      {after}
      <OtherPolicies current={policy.no} />
    </LegalPage>
  );
}
