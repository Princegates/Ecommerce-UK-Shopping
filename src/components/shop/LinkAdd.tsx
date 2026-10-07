"use client";

import Dropdown from "./Dropdown";
import LinkFinder from "./LinkFinder";

/** A visible "Add by link" button in the header: opens the link finder. */
export default function LinkAdd() {
  return (
    <Dropdown
      align="right"
      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-cta px-3 py-1.5 text-sm font-bold text-ink hover:bg-[var(--cta-hover)]"
      panelClassName="w-[min(24rem,92vw)] p-4"
      label={<><span aria-hidden="true" className="text-base leading-none">＋</span> Add by link</>}
    >
      <LinkFinder />
    </Dropdown>
  );
}
