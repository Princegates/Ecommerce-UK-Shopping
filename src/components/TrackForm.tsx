"use client";

import { useActionState } from "react";
import { trackAction, type TrackState } from "@/app/actions/track";

export default function TrackForm() {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackAction, {});
  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <p className="label">Tracking</p>
      <h1 className="text-3xl">Where is my order?</h1>
      <p className="mt-3 text-ink-soft">Enter your order number and the phone number or email you used at checkout.</p>
      <form action={action} className="box box-shadow mt-8 grid gap-4 p-5">
        <div className="field">
          <label className="label" htmlFor="number">Order number</label>
          <input id="number" name="number" className="input mono" placeholder="UKG-2026-000123" required defaultValue={state.number} autoComplete="off" />
        </div>
        <div className="field">
          <label className="label" htmlFor="contact">Phone or email</label>
          <input id="contact" name="contact" className="input" required autoComplete="off" />
        </div>
        <div aria-live="polite">{state.error && <p className="error-text" role="alert">{state.error}</p>}</div>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Looking…" : "Track order"}</button>
      </form>
    </div>
  );
}
