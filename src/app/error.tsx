"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined" && "console" in window) {
      console.error("[route-error]", error);
    }
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-5 py-16 text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-azure-600">
        Something went wrong
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink-900 md:text-3xl">
        We hit a snag loading this page.
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-600">
        It&apos;s not your fault — please try again. If the problem keeps happening, head back
        home, or get in touch and we&apos;ll look into it.
      </p>
      {error.message ? (
        <p className="mt-4 max-w-md break-words rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 font-mono text-xs text-ink-700">
          {error.message}
          {error.digest ? <span className="ml-1 text-ink-400">· {error.digest}</span> : null}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-azure-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-azure-600"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
