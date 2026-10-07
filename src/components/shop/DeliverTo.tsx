"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { setDeliveryZoneAction } from "@/app/actions/delivery";

/** Pick where you are, and every price in the shop shows what it costs delivered there. */
export default function DeliverTo({ zones, current }: { zones: { id: number; name: string }[]; current: number }) {
  const path = usePathname();
  const qs = useSearchParams().toString();
  return (
    <form action={setDeliveryZoneAction} className="flex items-center gap-2">
      <input type="hidden" name="back" value={`${path}${qs ? `?${qs}` : ""}`} />
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0"><path d="M12 21s7-6.100 7-11a7 7 0 10-14 0c0 4.900 7 11 7 11z" /><circle cx="12" cy="10" r="2.500" /></svg>
      <label className="grid leading-tight">
        <span className="label !text-[0.65rem]">Deliver to</span>
        <select
          name="zoneId" defaultValue={current} aria-label="Delivery area in Ghana"
          className="max-w-44 cursor-pointer truncate border-0 bg-transparent p-0 text-sm font-bold focus:outline-none focus-visible:outline-2"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      </label>
      <noscript><button className="btn btn-small">Set</button></noscript>
    </form>
  );
}
