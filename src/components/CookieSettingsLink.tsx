"use client";

import { OPEN_SETTINGS_EVENT } from "@/lib/consent";

/** Opens the cookie choice again, so a visitor can change their mind at any time. */
export default function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}>
      Cookie settings
    </button>
  );
}
