/** Lightweight placeholder while dashboard route segments stream in. */
export default function DashboardMainSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-24 rounded bg-ink-100" />
        <div className="h-8 w-full max-w-md rounded-lg bg-ink-100" />
        <div className="h-4 w-full max-w-xl rounded bg-ink-50" />
      </div>
      <div className="animate-pulse grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:gap-6">
        <div className="h-52 rounded-2xl bg-ink-100 lg:col-span-5" />
        <div className="h-72 rounded-2xl bg-ink-100 lg:col-span-7" />
      </div>
    </div>
  );
}
