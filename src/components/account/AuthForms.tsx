"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  forgotPasswordAction, loginAction, registerAction, resetPasswordAction, type FormState,
} from "@/app/actions/account";
import { Field, FormStatus } from "./Field";

const idle: FormState = {};

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [s, action, pending] = useActionState(loginAction, idle);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      {notice && <p role="status" className="box bg-gold/40 p-3 text-sm font-semibold">{notice}</p>}
      <Field label="Phone number or email" name="identifier" autoComplete="username" required defaultValue={s.values?.identifier} placeholder="024 123 4567" />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <FormStatus error={s.error} />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="text-sm"><Link href="/forgot-password" className="link">Forgot your password?</Link></p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [s, action, pending] = useActionState(registerAction, idle);
  const v = s.values ?? {};
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Full name" name="name" autoComplete="name" required defaultValue={v.name} />
      <Field label="Phone number" name="phone" type="tel" autoComplete="tel" required defaultValue={v.phone} placeholder="024 123 4567" hint="We call or text this number about deliveries." />
      <Field label="Email (optional)" name="email" type="email" autoComplete="email" defaultValue={v.email} hint="Used for receipts and to reset your password." />
      <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} hint="At least 8 characters. A few random words works well." />
      <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />
      <FormStatus error={s.error} />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Creating account…" : "Create my account"}</button>
      <p className="hint">By creating an account you agree to receive order updates by SMS and email. You can change this any time.</p>
    </form>
  );
}

export function ForgotForm() {
  const [s, action, pending] = useActionState(forgotPasswordAction, idle);
  if (s.done) {
    return (
      <div className="box bg-gold/30 p-4" role="status">
        <p className="font-semibold">Check your phone or email.</p>
        <p className="mt-1 text-sm">If there is an account with those details, we have sent a link to reset the password. It works for one hour.</p>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4">
      <Field label="Phone number or email on your account" name="identifier" autoComplete="username" required defaultValue={s.values?.identifier} />
      <FormStatus error={s.error} />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [s, action, pending] = useActionState(resetPasswordAction, idle);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
      <FormStatus error={s.error} />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Set new password"}</button>
    </form>
  );
}
