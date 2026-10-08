import type { Metadata } from "next";
import { logoutOthersAction } from "@/app/actions/account";
import { DeleteAccountForm, PasswordForm, SignInDetailsForm } from "@/components/account/AccountForms";
import { requireCustomer } from "@/lib/customer-session";
import { sessionCount } from "@/lib/customers";
import SocialButtons, { SocialErrorNote } from "@/components/account/SocialButtons";
import { listIdentities } from "@/lib/social/flow";
import { SOCIAL_LABEL, activeSocialProviders } from "@/lib/social/providers";

export const metadata: Metadata = { title: "Account security" };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ social_error?: string; linked?: string }> }) {
  const sp = await searchParams;
  const c = await requireCustomer("/account/security");
  const sessions = sessionCount(c.id);
  const identities = listIdentities(c.id);
  const connected = new Set(identities.map((i) => i.provider));
  const available = activeSocialProviders().filter((p) => !connected.has(p));
  return (
    <>
      <p className="label">Your account</p>
      <h1 className="text-3xl">Security</h1>
      <div className="mt-6 grid gap-8">
        <SignInDetailsForm phone={c.phone} email={c.email} />
        {(identities.length > 0 || available.length > 0) && (
          <section className="box box-shadow max-w-2xl p-6">
            <h2 className="text-2xl">Connected sign-in</h2>
            <SocialErrorNote code={sp.social_error} />
            {sp.linked && Object.hasOwn(SOCIAL_LABEL, sp.linked) && <p role="status" className="box mt-3 bg-gold/40 p-3 text-sm font-semibold">{SOCIAL_LABEL[sp.linked as keyof typeof SOCIAL_LABEL]} is now connected.</p>}
            {identities.length > 0 && (
              <ul className="mt-3 grid gap-1 text-sm">
                {identities.map((i) => <li key={i.provider}><span className="font-semibold">{SOCIAL_LABEL[i.provider]}</span> is connected{i.email ? ` (${i.email})` : ""}.</li>)}
              </ul>
            )}
            {available.length > 0 && (
              <>
                <p className="mt-3 text-sm text-ink-soft">Connect another way to sign in to this same account.</p>
                <div className="mt-3 max-w-sm"><SocialButtons providers={available} link verb="Connect" /></div>
              </>
            )}
          </section>
        )}
        <PasswordForm />
        <section className="box box-shadow max-w-2xl p-6">
          <h2 className="text-2xl">Signed-in devices</h2>
          <p className="mt-2 text-sm text-ink-soft">
            You are signed in on {sessions} {sessions === 1 ? "device" : "devices"}. If you used a shared phone or computer, sign the others out.
          </p>
          <form action={logoutOthersAction} className="mt-4">
            <button className="btn">Sign out my other devices</button>
          </form>
        </section>
        <DeleteAccountForm />
      </div>
    </>
  );
}
