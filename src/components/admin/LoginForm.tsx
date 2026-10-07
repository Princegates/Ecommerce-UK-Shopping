"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "@/app/admin/actions";

export default function LoginForm({ devHint, developer }: { devHint: boolean; developer: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  // kept in state so a wrong password does not also wipe the email the person typed
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="box box-shadow mt-8 grid gap-4 p-5">
      <input type="hidden" name="mode" value={developer ? "developer" : "staff"} />
      {developer ? (
        <p className="text-sm text-ink-soft">Developer sign-in. This is the super admin, for the person who runs the server. Staff sign in with their email instead.</p>
      ) : (
        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label className="label" htmlFor="password">{developer ? "Developer password" : "Password"}</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required autoFocus={developer} />
      </div>
      <div aria-live="polite">{state.error && <p className="error-text" role="alert">{state.error}</p>}</div>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="hint">
        {developer ? <Link href="/admin/login" className="link">Staff sign-in</Link> : <Link href="/admin/login?developer=1" className="link">Developer sign-in</Link>}
      </p>
      {devHint && developer && (
        <p className="hint">
          Development mode: the password is <code className="mono">admin</code>. Set ADMIN_PASSWORD and ADMIN_SECRET to
          change it. In production the admin stays locked until both are set.
        </p>
      )}
    </form>
  );
}
