"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/admin/actions";

export default function LoginForm({ devHint }: { devHint: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="box box-shadow mt-8 grid gap-4 p-5">
      <div className="field">
        <label className="label" htmlFor="password">Admin password</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required autoFocus />
      </div>
      <div aria-live="polite">{state.error && <p className="error-text" role="alert">{state.error}</p>}</div>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      {devHint && (
        <p className="hint">
          Development mode: the password is <code className="mono">admin</code>. Set ADMIN_PASSWORD and ADMIN_SECRET to
          change it. In production the admin stays locked until both are set.
        </p>
      )}
    </form>
  );
}
