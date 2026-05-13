"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined" && "console" in window) {
      console.error("[dashboard-error]", error);
    }
  }, [error]);

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
      <p className="font-mono text-[10px] uppercase tracking-widest text-red-700">
        Dashboard error
      </p>
      <h2 className="mt-2 text-lg font-semibold">
        We couldn&apos;t load this dashboard section.
      </h2>
      <p className="mt-2 text-sm">
        This is on our side. Try again, or come back to the dashboard home.
      </p>
      {error.message ? (
        <p className="mt-3 break-words rounded-lg border border-red-200 bg-white/70 px-3 py-2 font-mono text-xs text-red-800">
          {error.message}
          {error.digest ? <span className="ml-1 text-red-500">· {error.digest}</span> : null}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
        >
          Dashboard home
        </Link>
        <Link
          href="/"
          className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
        >
          Public site
        </Link>
      </div>
    </div>
  );
}
