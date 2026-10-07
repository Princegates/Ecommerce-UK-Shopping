"use client";

import { useActionState } from "react";
import { generateResetLinkAction, type ResetLinkState } from "@/app/admin/ops-actions";

export default function ResetLinkForm({ id }: { id: number }) {
  const [s, action, pending] = useActionState<ResetLinkState, FormData>(generateResetLinkAction, {});
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-small w-fit" disabled={pending}>{pending ? "Creating…" : "Create a password reset link"}</button>
      {s.error && <p role="alert" className="error-text">{s.error}</p>}
      {s.link && (
        <div className="grid gap-1">
          <label className="label" htmlFor="reset-link">Give this link to the customer. It works once, for one hour.</label>
          <input id="reset-link" readOnly value={s.link} className="input mono text-sm" onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
    </form>
  );
}
