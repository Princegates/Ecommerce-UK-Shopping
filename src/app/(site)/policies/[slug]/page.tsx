import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PolicyPage from "@/components/PolicyPage";
import { policyBySlug } from "@/lib/policies";

export const dynamic = "force-dynamic";

// the Terms and the Privacy Policy have their own addresses
const OWN_PAGE = new Set(["terms", "privacy"]);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = policyBySlug((await params).slug);
  return { title: p ? p.title : "Policy" };
}

export default async function PolicyRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = policyBySlug(slug);
  if (!policy || OWN_PAGE.has(slug)) notFound();
  return (
    <PolicyPage
      policy={policy}
      after={policy.no === 7 ? (
        <p className="mt-6">
          The items we cannot take at the moment, such as muscle stimulators (TENS and EMS machines) and powered massage machines, are listed on{" "}
          <Link className="link" href="/restricted-items">Items we cannot ship</Link>.
        </p>
      ) : undefined}
    />
  );
}
