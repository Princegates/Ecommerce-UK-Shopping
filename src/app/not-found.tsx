import Link from "next/link";
import { getSettings } from "@/lib/settings";

export default function NotFound() {
  const { siteName } = getSettings();
  return (
    <main className="mx-auto grid min-h-[70vh] max-w-2xl place-content-center px-4 py-20 text-center">
      <p className="label">Error 404</p>
      <h1 className="mt-2 text-6xl">Nothing here</h1>
      <p className="mx-auto mt-4 max-w-md text-ink-soft">
        That page does not exist, or the item is no longer listed on {siteName}.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link href="/" className="btn btn-primary">Back to home</Link>
        <Link href="/shops" className="btn">Browse the shops</Link>
        <Link href="/search" className="btn">Search</Link>
      </div>
    </main>
  );
}
