import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/account/AuthShell";
import { ForgotForm } from "@/components/account/AuthForms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <AuthShell
      title="Reset your password"
      lead="Enter the phone number or email on your account and we will send you a link."
      footer={<Link className="link font-semibold" href="/login">Back to sign in</Link>}
    >
      <ForgotForm />
    </AuthShell>
  );
}
