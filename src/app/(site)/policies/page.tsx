import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { POLICY_LINKS } from "@/components/PolicyPage";
import { POLICY_EFFECTIVE } from "@/lib/policies";

export const metadata: Metadata = { title: "Our policies" };

export default function PoliciesPage() {
  return (
    <LegalPage title="Our policies" effective={POLICY_EFFECTIVE} intro="How ordering, pricing, shipping, customs, insurance, returns and your data work, in plain terms. The Terms and Conditions of Service and policies 2 to 13 apply to every order.">
      <ul className="!list-none !pl-0">
        {POLICY_LINKS.map((l) => (
          <li key={l.href} className="box !mt-3 p-4">
            <Link className="link font-semibold" href={l.href}>Policy {l.no}. {l.label}</Link>
          </li>
        ))}
        <li className="box !mt-3 p-4"><Link className="link font-semibold" href="/data-deletion">Delete your data</Link></li>
        <li className="box !mt-3 p-4"><Link className="link font-semibold" href="/restricted-items">Items we cannot ship</Link></li>
      </ul>
    </LegalPage>
  );
}
