import { setThemeAction } from "@/app/admin/ops-actions";
import { Flash, PageHead } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { THEMES, type Theme } from "@/lib/themes";

export const dynamic = "force-dynamic";

/** A small drawing of the shop in a theme's colours. */
function Mini({ t }: { t: Theme }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line" style={{ background: t.paper }} aria-hidden="true">
      <div className="flex items-center justify-between px-3 py-2" style={{ background: t.head }}>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rotate-45 rounded-sm" style={{ background: t.cta }} />
          <span className="h-2 w-12 rounded-full bg-white/80" />
        </span>
        <span className="h-4 w-12 rounded-md" style={{ background: t.cta }} />
      </div>
      <div className="flex gap-1.5 px-3 py-1.5" style={{ background: t.head2 }}>
        {[10, 14, 9, 12].map((w, i) => <span key={i} className="h-1.5 rounded-full bg-white/70" style={{ width: `${w * 3}px` }} />)}
      </div>
      <div className="grid grid-cols-[1.4fr_1fr] gap-2 p-3">
        <div className="rounded-lg bg-white p-2">
          <div className="grid h-12 place-items-center rounded-md text-xs font-bold text-white" style={{ background: t.brand }}>Aa</div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-2.5 w-10 rounded-sm" style={{ background: t.spark }} />
            <span className="h-2 w-8 rounded-full" style={{ background: t.link }} />
          </div>
          <div className="mt-2 h-4 w-full rounded-md" style={{ background: t.cta }} />
        </div>
        <div className="grid content-start gap-1.5">
          <div className="h-5 rounded-md" style={{ background: t.brand }} />
          <div className="h-2 rounded-full bg-black/10" />
          <div className="h-2 w-3/4 rounded-full bg-black/10" />
        </div>
      </div>
    </div>
  );
}

export default async function AppearanceAdmin({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const active = getSettings().theme;
  return (
    <>
      <PageHead title="Appearance" />
      <Flash saved={sp.saved} error={sp.error} />
      <p className="mb-6 max-w-3xl text-ink-soft">
        Pick a colour theme for the whole shop. The change shows on every page straight away, for every visitor, and the admin picks up the same
        colours. Every theme keeps text easy to read. Layout, prices and wording stay the same.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {THEMES.map((t) => {
          const on = t.id === active;
          return (
            <li key={t.id} className={`box grid gap-3 p-4 ${on ? "!border-blue ring-2 ring-blue" : ""}`}>
              <Mini t={t} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold">{t.name}</h2>
                  <p className="text-sm text-ink-soft">{t.mood}</p>
                  <ul className="mt-2 flex gap-1.5" aria-label="Colours in this theme">
                    {[t.head, t.brand, t.cta, t.spark, t.link].map((c, i) => <li key={i} className="h-5 w-5 rounded-full border border-black/10" style={{ background: c }} title={c} />)}
                  </ul>
                </div>
                {on ? (
                  <span className="tag tag-green shrink-0">In use</span>
                ) : (
                  <form action={setThemeAction} className="shrink-0">
                    <input type="hidden" name="theme" value={t.id} />
                    <button className="btn btn-small btn-primary">Use this theme</button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
