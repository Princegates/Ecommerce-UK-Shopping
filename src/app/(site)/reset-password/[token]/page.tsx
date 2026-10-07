import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/account/AuthShell";
import { ResetForm } from "@/components/account/AuthForms";
import { resetTokenValid } from "@/lib/customers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = resetTokenValid(token);
  return (
    <AuthShell title="Choose a new password" footer={<Link className="link font-semibold" href="/login">Back to sign in</Link>}>
      {valid ? (
        <ResetForm token={token} />
      ) : (
        <div className="grid gap-3">
          <p className="error-text">This reset link has expired or was already used.</p>
          <Link href="/forgot-password" className="btn btn-primary w-fit">Get a new link</Link>
        </div>
      )}
    </AuthShell>
  );
}
