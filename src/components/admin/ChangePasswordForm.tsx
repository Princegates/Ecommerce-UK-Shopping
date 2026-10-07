"use client";

import { useActionState } from "react";
import { changeOwnPasswordAction, type PasswordState } from "@/app/admin/users-actions";

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changeOwnPasswordAction, {});
  return (
    <form action={action} className="box box-shadow grid max-w-lg gap-4 p-5">
      <div className="field">
        <label className="label" htmlFor="cp-current">Current password</label>
        <input id="cp-current" name="current" type="password" className="input" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label className="label" htmlFor="cp-next">New password</label>
        <input id="cp-next" name="next" type="password" className="input" autoComplete="new-password" minLength={10} required />
        <p className="hint">At least 10 characters. A few random words is a good way to make a long one.</p>
      </div>
      <div className="field">
        <label className="label" htmlFor="cp-confirm">New password again</label>
        <input id="cp-confirm" name="confirm" type="password" className="input" autoComplete="new-password" minLength={10} required />
      </div>
      <div aria-live="polite">{state.error && <p className="error-text" role="alert">{state.error}</p>}</div>
      <button className="btn btn-primary w-fit" disabled={pending}>{pending ? "Saving…" : "Change password"}</button>
    </form>
  );
}
