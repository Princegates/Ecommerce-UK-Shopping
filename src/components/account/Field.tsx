import type { ReactNode } from "react";

export function Field({
  label, name, type = "text", defaultValue, autoComplete, required, hint, placeholder, inputMode, minLength, maxLength,
}: {
  label: string; name: string; type?: string; defaultValue?: string; autoComplete?: string; required?: boolean; hint?: ReactNode;
  placeholder?: string; inputMode?: "text" | "tel" | "email" | "numeric" | "decimal"; minLength?: number; maxLength?: number;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={name}>{label}</label>
      <input
        id={name} name={name} type={type} className="input" defaultValue={defaultValue} autoComplete={autoComplete} required={required}
        placeholder={placeholder} inputMode={inputMode} minLength={minLength} maxLength={maxLength}
      />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function FormStatus({ error, message }: { error?: string; message?: string }) {
  return (
    <div aria-live="polite">
      {error && <p role="alert" className="error-text">{error}</p>}
      {message && !error && <p role="status" className="box bg-gold/40 p-3 font-semibold">{message}</p>}
    </div>
  );
}
