"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OPEN_SETTINGS_EVENT, readChoice, writeChoice, type CookieChoice } from "@/lib/consent";

/**
 * Asks once, at the bottom of the page, and again whenever "Cookie settings" is pressed in the footer. "Essential only" is as easy
 * to pick as "Accept all". It sits above the phone tab bar so neither is hidden.
 */
export default function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOpen(readChoice() === null), 0);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, reopen);
    return () => { clearTimeout(t); window.removeEventListener(OPEN_SETTINGS_EVENT, reopen); };
  }, []);

  function choose(c: CookieChoice) {
    writeChoice(c);
    setOpen(false);
  }

  if (!open) return null;
  return (
    <section
      role="region"
      aria-label="Cookies"
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 px-3 md:bottom-4 md:px-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-line bg-white p-4 text-ink shadow-[0_8px_30px_rgba(16,20,18,0.28)] md:flex-row md:items-center">
        <p className="text-sm">
          <strong>Cookies.</strong> We use the cookies the shop needs to work, such as your cart, sign-in and delivery area. With your OK we also remember the items you viewed, on this device only.
          We use no advertising or tracking cookies. <Link href="/cookies" className="link font-semibold">Cookie policy</Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn btn-small min-h-11 flex-1 md:flex-none" onClick={() => choose("essential")}>Essential only</button>
          <button type="button" className="btn btn-primary btn-small min-h-11 flex-1 md:flex-none" onClick={() => choose("all")}>Accept all</button>
        </div>
      </div>
    </section>
  );
}
