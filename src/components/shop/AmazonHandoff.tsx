import Link from "next/link";

/** "Not here? Look on Amazon UK": a plain link to Amazon's own search, opened by the customer. The shop never requests Amazon's pages. */
export default function AmazonHandoff({ query }: { query: string }) {
  const href = `https://www.amazon.co.uk/s?${new URLSearchParams({ k: query })}`;
  return (
    <aside aria-label="Search Amazon UK" className="mx-auto max-w-7xl px-4 pt-6">
      <div className="box flex flex-wrap items-center justify-between gap-3 border-cta bg-cta/20 p-4">
        <p className="max-w-2xl text-sm">
          <span className="font-bold">Want it from Amazon UK?</span> Find it there, then send us the link (or use Share on your phone). We price it in cedis, you pay, and we buy and ship it.{" "}
          <Link href="/amazon" className="link font-semibold">How it works</Link>
        </p>
        <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-gold">Search Amazon UK for &ldquo;{query}&rdquo; ↗</a>
      </div>
    </aside>
  );
}
