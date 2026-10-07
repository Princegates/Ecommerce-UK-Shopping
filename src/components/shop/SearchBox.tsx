"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ghs } from "@/lib/money";

type Suggestion = {
  products: { name: string; slug: string; shop: string; accent: string; imageUrl: string | null; priceMinor: number }[];
  shops: { name: string; slug: string; category: string }[];
  departments: { name: string; slug: string }[];
};

type Row = { key: string; href: string; node: React.ReactNode };

/** Search with a department picker and as-you-type suggestions, usable by keyboard and screen reader. */
export default function SearchBox({ departments, initialQuery = "", initialDepartment = "" }: {
  departments: { name: string; slug: string }[]; initialQuery?: string; initialDepartment?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [dept, setDept] = useState(initialDepartment);
  const [sug, setSug] = useState<Suggestion | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLFormElement>(null);
  const listId = useId();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        if (res.ok) { setSug((await res.json()) as Suggestion); setActive(-1); }
      } catch { /* a newer keystroke replaced this request */ }
    }, 180);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const searchHref = `/search?q=${encodeURIComponent(q.trim())}${dept ? `&d=${encodeURIComponent(dept)}` : ""}`;
  const rows: Row[] = [];
  const shown = q.trim().length >= 2 ? sug : null;
  if (shown) {
    for (const p of shown.products) {
      rows.push({
        key: `p-${p.slug}`, href: `/products/${p.slug}`,
        node: (
          <span className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center border-2 border-ink text-sm font-bold text-white" style={{ background: p.accent }} aria-hidden="true">{p.name.slice(0, 1)}</span>
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{p.name}</span><span className="label">{p.shop}</span></span>
            <span className="num text-sm font-semibold">{ghs(p.priceMinor)}</span>
          </span>
        ),
      });
    }
    for (const s of shown.shops) rows.push({ key: `s-${s.slug}`, href: `/shops/${s.slug}`, node: <span>Shop: <strong>{s.name}</strong> <span className="label ml-1">{s.category}</span></span> });
    for (const d of shown.departments) rows.push({ key: `d-${d.slug}`, href: `/department/${d.slug}`, node: <span>Department: <strong>{d.name}</strong></span> });
  }
  if (q.trim().length >= 2) rows.push({ key: "all", href: searchHref, node: <span className="font-semibold">See all results for &ldquo;{q.trim()}&rdquo; →</span> });

  const show = open && rows.length > 0;

  return (
    <form
      ref={box}
      action="/search"
      role="search"
      className="relative flex w-full min-w-0"
      onSubmit={(e) => {
        if (active >= 0 && rows[active]) { e.preventDefault(); setOpen(false); router.push(rows[active].href); }
      }}
    >
      <label htmlFor="site-dept" className="sr-only">Department</label>
      <select id="site-dept" name={dept ? "d" : undefined} value={dept} onChange={(e) => setDept(e.target.value)} className="select hidden !w-auto max-w-40 !border-r-0 !bg-paper-2 font-semibold md:block">
        <option value="">All</option>
        {departments.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
      </select>
      <label htmlFor="site-q" className="sr-only">Search items and shops</label>
      <input
        id="site-q" name="q" type="search" autoComplete="off" value={q} placeholder="Search trainers, laptops, skincare…" className="input min-w-0 flex-1 !border-r-0"
        role="combobox" aria-expanded={show} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(rows.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
          else if (e.key === "Escape") { setOpen(false); setActive(-1); }
        }}
      />
      <button className="btn btn-primary !shadow-none" type="submit" aria-label="Search">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><circle cx="10.500" cy="10.500" r="6.500" /><path d="M16 16l5 5" /></svg>
      </button>
      {show && (
        <ul id={listId} role="listbox" aria-label="Suggestions" className="panel suggest absolute left-0 right-0 top-full z-50 mt-1">
          {rows.map((r, idx) => (
            <li key={r.key} id={`${listId}-${idx}`} role="option" aria-selected={idx === active}>
              <a href={r.href} className="block px-3 py-2" onClick={() => setOpen(false)} onMouseEnter={() => setActive(idx)}>{r.node}</a>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
