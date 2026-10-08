import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AuthShell from "@/components/account/AuthShell";
import { SocialSignupForm } from "@/components/account/AuthForms";
import { getCustomer } from "@/lib/customer-session";
import { getPendingSignup } from "@/lib/social/flow";
import { SOCIAL_LABEL } from "@/lib/social/providers";
import { signupCookieName } from "@/lib/social/cookies";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Finish creating your account", robots: { index: false } };

export default async function SocialSignupPage() {
  if (await getCustomer()) redirect("/account");
  const pending = getPendingSignup((await cookies()).get(signupCookieName())?.value);
  if (!pending) redirect("/login?social_error=expired");
  const label = SOCIAL_LABEL[pending.provider];
  return (
    <AuthShell
      title="One last step"
      lead={`You are signing up with ${label}. Add the phone number we can reach you on.`}
      footer={<>Changed your mind? <Link className="link font-semibold" href="/login">Back to sign in</Link></>}
    >
      <SocialSignupForm provider={label} name={pending.name} email={pending.email} />
    </AuthShell>
  );
}
