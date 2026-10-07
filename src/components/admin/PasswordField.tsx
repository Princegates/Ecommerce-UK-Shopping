"use client";

import { useState } from "react";

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generate(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** A password box that can suggest a strong one, shown in plain text so the super admin can pass it on. */
export default function PasswordField({ label, name = "password", hint }: { label: string; name?: string; hint?: string }) {
  const [value, setValue] = useState("");
  return (
    <div className="field">
      <label className="label" htmlFor={`pw-${name}`}>{label}</label>
      <div className="flex gap-2">
        <input id={`pw-${name}`} name={name} type="text" className="input mono min-w-0 flex-1" autoComplete="off" required minLength={10} value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="button" className="btn btn-small shrink-0" onClick={() => setValue(generate())}>Suggest one</button>
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
