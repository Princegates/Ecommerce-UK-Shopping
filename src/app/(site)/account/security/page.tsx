import type { Metadata } from "next";
import { logoutOthersAction } from "@/app/actions/account";
import { DeleteAccountForm, PasswordForm, SignInDetailsForm } from "@/components/account/AccountForms";
import { requireCustomer } from "@/lib/customer-session";
import { sessionCount } from "@/lib/customers";

export const metadata: Metadata = { title: "Account security" };

export default async function SecurityPage() {
  const c = await requireCustomer("/account/security");
  const sessions = sessionCount(c.id);
  return (
    <>
      <p className="label">Your account</p>
      <h1 className="text-3xl">Security</h1>
      <div className="mt-6 grid gap-8">
        <SignInDetailsForm phone={c.phone} email={c.email} />
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
