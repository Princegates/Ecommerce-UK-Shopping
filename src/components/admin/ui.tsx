import type { ReactNode } from "react";

export function Flash({ saved, error }: { saved?: string; error?: string }) {
  if (error) return <p role="alert" className="box mb-6 border-red bg-red/10 p-3 font-semibold text-red">{error}</p>;
  if (saved) return <p role="status" className="box mb-6 bg-gold/40 p-3 font-semibold">Saved.</p>;
  return null;
}

export function Text({
  label, name, defaultValue, hint, type = "text", required, inputMode, placeholder, className = "", id,
}: {
  /** set when the same form appears more than once on a page, so each label points at its own field */
  id?: string;
  label: string; name: string; defaultValue?: string | number; hint?: string; type?: string; required?: boolean;
  inputMode?: "decimal" | "numeric" | "text"; placeholder?: string; className?: string;
}) {
  return (
    <div className={`field ${className}`}>
      <label className="label" htmlFor={id ?? name}>{label}</label>
      <input id={id ?? name} name={name} type={type} className="input" defaultValue={defaultValue} required={required} inputMode={inputMode} placeholder={placeholder} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Area({
  label, name, defaultValue, hint, rows = 4, mono, id,
}: { id?: string; label: string; name: string; defaultValue?: string; hint?: string; rows?: number; mono?: boolean }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id ?? name}>{label}</label>
      <textarea id={id ?? name} name={name} rows={rows} className={`textarea ${mono ? "mono text-sm" : ""}`} defaultValue={defaultValue} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Check({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 font-semibold">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-5 w-5 accent-[var(--green)]" />
      {label}
    </label>
  );
}

export function Select({
  label, name, defaultValue, children, hint,
}: { label: string; name: string; defaultValue?: string | number; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} className="select" defaultValue={defaultValue}>{children}</select>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-4xl">{title}</h1>
      {children}
    </div>
  );
}
