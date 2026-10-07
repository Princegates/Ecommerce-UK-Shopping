"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export type NavGroup = { heading: string; items: { href: string; label: string; badge?: number }[] };

/** The admin menu on phones: a bar with a Menu button that opens the full list, and closes again after a page is chosen. */
export default function MobileNav({ siteName, groups, who, signOut }: { siteName: string; groups: NavGroup[]; who: string; signOut: ReactNode }) {
  const path = usePathname();
  // the menu is open for one page only, so choosing a link (which changes the page) closes it
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === path;
  const setOpen = (next: boolean | ((v: boolean) => boolean)) => setOpenFor((cur) => ((typeof next === "function" ? next(cur === path) : next) ? path : null));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenFor(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const current = groups.flatMap((g) => g.items).filter((i) => (i.href === "/admin" ? path === "/admin" : path.startsWith(i.href))).sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="display truncate text-xl leading-tight">{siteName}</p>
          <p className="label !text-gold">Admin{current ? ` · ${current.label}` : ""}</p>
        </div>
        <button
          type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="admin-menu"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-paper/40 px-4 font-bold hover:bg-paper/10"
        >
          <span aria-hidden="true">{open ? "✕" : "☰"}</span> {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <nav id="admin-menu" aria-label="Admin" className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-paper/20 px-2 pb-4">
          {groups.map((g) => (
            <div key={g.heading} className="mt-3">
              <p className="label px-3 !text-paper/50">{g.heading}</p>
              <ul className="mt-1 grid grid-cols-2 gap-1">
                {g.items.map((i) => (
                  <li key={i.href}>
                    <Link
                      href={i.href} aria-current={current?.href === i.href ? "page" : undefined}
                      className={`flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2 font-semibold ${current?.href === i.href ? "bg-gold text-ink" : "bg-paper/10 hover:bg-gold hover:text-ink"}`}
                    >
                      <span>{i.label}</span>
                      {i.badge ? <span className="tag tag-gold">{i.badge}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="mt-4 grid gap-2 border-t border-paper/20 px-1 pt-4">
            <p className="text-sm text-paper/70">Signed in as {who}</p>
            <Link href="/" className="flex min-h-11 items-center text-sm font-semibold text-gold hover:underline">View the site ↗</Link>
            {signOut}
          </div>
        </nav>
      )}
    </div>
  );
}
