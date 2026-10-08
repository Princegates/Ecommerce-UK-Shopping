"use client";

import { useActionState } from "react";
import {
  changePasswordAction, changeSignInAction, deleteAccountAction, saveAddressAction, updateProfileAction, type FormState,
} from "@/app/actions/account";
import { Field, FormStatus } from "./Field";

const idle: FormState = {};

export function ProfileForm({
  customer, zones,
}: {
  customer: { name: string; phone: string; email: string | null; notifySms: boolean; notifyEmail: boolean; notifyWhatsapp: boolean; defaultZoneId: number | null };
  zones: { id: number; name: string }[];
}) {
  const [s, action, pending] = useActionState(updateProfileAction, idle);
  return (
    <form action={action} className="box box-shadow grid max-w-2xl gap-5 p-6">
      <Field label="Full name" name="name" defaultValue={customer.name} required autoComplete="name" />
      <div className="field">
        <label className="label" htmlFor="defaultZoneId">Usual delivery area</label>
        <select id="defaultZoneId" name="defaultZoneId" className="select" defaultValue={customer.defaultZoneId ?? ""}>
          <option value="">Not set</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <p className="hint">Used to show delivery costs across the shop.</p>
      </div>
      <fieldset className="grid gap-2">
        <legend className="label mb-1 text-ink">Send me order updates by</legend>
        {([["notifySms", "SMS", customer.notifySms], ["notifyEmail", "Email", customer.notifyEmail], ["notifyWhatsapp", "WhatsApp", customer.notifyWhatsapp]] as const).map(([name, label, on]) => (
          <label key={name} className="flex items-center gap-2 font-semibold">
            <input type="checkbox" name={name} defaultChecked={on} className="h-5 w-5 accent-[var(--green)]" /> {label}
          </label>
        ))}
        <p className="hint">Updates are only sent about your orders. WhatsApp needs your opt-in.</p>
      </fieldset>
      <FormStatus error={s.error} message={s.message} />
      <div><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button></div>
    </form>
  );
}

export function SignInDetailsForm({ phone, email }: { phone: string; email: string | null }) {
  const [s, action, pending] = useActionState(changeSignInAction, idle);
  return (
    <form action={action} className="box box-shadow grid max-w-2xl gap-4 p-6">
      <h2 className="text-2xl">Phone and email</h2>
      <p className="text-sm text-ink-soft">You sign in with these. Enter your password to change them.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone number" name="phone" type="tel" defaultValue={phone} required autoComplete="tel" />
        <Field label="Email (optional)" name="email" type="email" defaultValue={email ?? ""} autoComplete="email" />
      </div>
      <Field label="Current password" name="currentPassword" type="password" required autoComplete="current-password" />
      <FormStatus error={s.error} message={s.message} />
      <div><button className="btn" disabled={pending}>{pending ? "Saving…" : "Update details"}</button></div>
    </form>
  );
}

export function PasswordForm() {
  const [s, action, pending] = useActionState(changePasswordAction, idle);
  return (
    <form action={action} className="box box-shadow grid max-w-2xl gap-4 p-6">
      <h2 className="text-2xl">Change password</h2>
      <Field label="Current password" name="current" type="password" required autoComplete="current-password" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" name="next" type="password" required minLength={8} autoComplete="new-password" />
        <Field label="Confirm new password" name="confirm" type="password" required autoComplete="new-password" />
      </div>
      <FormStatus error={s.error} message={s.message} />
      <div><button className="btn" disabled={pending}>{pending ? "Saving…" : "Change password"}</button></div>
    </form>
  );
}

export function DeleteAccountForm({ needsPassword = true }: { needsPassword?: boolean }) {
  const [s, action, pending] = useActionState(deleteAccountAction, idle);
  return (
    <form action={action} className="box grid max-w-2xl gap-4 border-red p-6">
      <h2 className="text-2xl text-red">Delete my account</h2>
      <p className="text-sm">
        This removes your profile, saved addresses and saved items. Orders you have placed are kept for our records, with the
        delivery details you gave for them, but are no longer linked to an account. This cannot be undone.
      </p>
      {needsPassword && <Field label="Your password" name="password" type="password" required autoComplete="current-password" />}
      <Field label="Type DELETE to confirm" name="confirm" required autoComplete="off" />
      <FormStatus error={s.error} />
      <div><button className="btn btn-danger" disabled={pending}>{pending ? "Deleting…" : "Delete my account"}</button></div>
    </form>
  );
}

export function AddressForm({
  address, zones, onlyOne,
}: {
  address?: { id: number; label: string; recipient: string; phone: string; zoneId: number | null; address: string; landmark: string; isDefault: boolean };
  zones: { id: number; name: string }[];
  onlyOne?: boolean;
}) {
  const [s, action, pending] = useActionState(saveAddressAction, idle);
  const v = s.values ?? {};
  const val = (k: string, fallback = "") => (v[k] !== undefined ? v[k] : fallback);
  const id = address?.id ?? 0;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Label" name="label" defaultValue={val("label", address?.label ?? "Home")} placeholder="Home, Work…" maxLength={30} />
        <Field label="Recipient name" name="recipient" defaultValue={val("recipient", address?.recipient ?? "")} required autoComplete="name" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone for the rider" name="phone" type="tel" defaultValue={val("phone", address?.phone ?? "")} required autoComplete="tel" />
        <div className="field">
          <label className="label" htmlFor={`zone-${id}`}>Delivery area</label>
          <select id={`zone-${id}`} name="zoneId" className="select" defaultValue={val("zoneId", String(address?.zoneId ?? ""))}>
            <option value="">Choose…</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor={`addr-${id}`}>Address</label>
        <textarea id={`addr-${id}`} name="address" className="textarea" defaultValue={val("address", address?.address ?? "")} required placeholder="House number, street, area, town" />
      </div>
      <Field label="Landmark or GhanaPost GPS code (optional)" name="landmark" defaultValue={val("landmark", address?.landmark ?? "")} />
      {!address?.isDefault && !onlyOne && (
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" name="makeDefault" defaultChecked={v.makeDefault === "on"} className="h-5 w-5 accent-[var(--green)]" /> Make this my default address
        </label>
      )}
      <FormStatus error={s.error} message={s.message} />
      <div><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : address ? "Save changes" : "Save address"}</button></div>
    </form>
  );
}
