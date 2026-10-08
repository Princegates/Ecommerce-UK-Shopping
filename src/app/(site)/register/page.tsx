import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/components/account/AuthShell";
import { RegisterForm } from "@/components/account/AuthForms";
import SocialButtons, { SocialDivider } from "@/components/account/SocialButtons";
import { getCustomer, safeNext } from "@/lib/customer-session";
import { activeSocialProviders } from "@/lib/social/providers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCustomer()) redirect(next);
  const social = activeSocialProviders();
  return (
    <AuthShell
      title="Create your account"
      lead="It takes a minute and makes every order easier."
      footer={<>Already have an account? <Link className="link font-semibold" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></>}
    >
      <SocialButtons providers={social} next={next} verb="Sign up with" />
      {social.length > 0 && <SocialDivider />}
      <RegisterForm next={next} />
    </AuthShell>
  );
}
