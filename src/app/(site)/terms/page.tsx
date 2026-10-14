import type { Metadata } from "next";
import PolicyPage from "@/components/PolicyPage";
import { policyBySlug } from "@/lib/policies";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Terms and conditions of service" };

export default function TermsPage() {
  return <PolicyPage policy={policyBySlug("terms")!} />;
}
