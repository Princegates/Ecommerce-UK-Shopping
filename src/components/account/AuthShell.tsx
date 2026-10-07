import type { ReactNode } from "react";

const PERKS = [
  ["Track every order", "One timeline from purchase to your door."],
  ["Check out in seconds", "Saved addresses and your details, ready to go."],
  ["Save and buy again", "A wishlist, and one tap to reorder past favourites."],
  ["Updates your way", "SMS, email or WhatsApp, whichever you prefer."],
] as const;

/** Split layout shared by sign in, register and password reset. */
export default function AuthShell({ title, lead, children, footer }: { title: string; lead?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-0 px-4 py-10 md:grid-cols-[1fr_1.1fr] md:py-16">
      <aside className="hidden border-2 border-r-0 border-ink bg-ink p-10 text-paper md:block">
        <p className="label !text-gold">Your account</p>
        <h2 className="mt-3 text-4xl text-paper">Everything about your UK orders, in one place.</h2>
        <ul className="mt-10 grid gap-6">
          {PERKS.map(([t, b]) => (
            <li key={t} className="flex gap-4">
              <span aria-hidden="true" className="mono mt-0.5 grid h-6 w-6 shrink-0 place-items-center bg-gold font-semibold text-ink">✓</span>
              <span>
                <span className="block font-semibold">{t}</span>
                <span className="text-paper/70">{b}</span>
              </span>
            </li>
          ))}
        </ul>
      </aside>
      <section className="border-2 border-ink bg-paper-3 p-6 shadow-[5px_5px_0_var(--ink)] md:p-10">
        <h1 className="text-4xl">{title}</h1>
        {lead && <p className="mt-2 text-ink-soft">{lead}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 border-t-2 border-dashed border-ink/30 pt-4 text-sm">{footer}</div>}
      </section>
    </div>
  );
}
