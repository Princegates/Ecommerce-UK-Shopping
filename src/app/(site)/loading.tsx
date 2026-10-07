/** Shimmering placeholders shown while a page loads. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[90rem] px-3 py-4 md:px-4" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-56 w-full md:h-72" />
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-3">
            <div className="skeleton aspect-square w-full" />
            <div className="skeleton mt-3 h-3 w-4/5" />
            <div className="skeleton mt-2 h-3 w-2/5" />
            <div className="skeleton mt-3 h-6 w-3/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
