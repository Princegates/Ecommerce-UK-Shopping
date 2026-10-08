import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/components/account/AuthShell";
import { LoginForm } from "@/components/account/AuthForms";
import SocialButtons, { SocialDivider, SocialErrorNote } from "@/components/account/SocialButtons";
import { getCustomer, safeNext } from "@/lib/customer-session";
import { activeSocialProviders } from "@/lib/social/providers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string; social_error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCustomer()) redirect(next);
  const social = activeSocialProviders();
  const notice = next.startsWith("/checkout") ? "Sign in to check out. Your cart is saved." : undefined;
  return (
    <AuthShell
      title="Sign in"
      lead="Welcome back."
      footer={<>New here? <Link className="link font-semibold" href={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link></>}
    >
      <SocialErrorNote code={sp.social_error} />
      <SocialButtons providers={social} next={next} />
      {social.length > 0 && <SocialDivider />}
      <LoginForm next={next} notice={notice} />
    </AuthShell>
  );
}
