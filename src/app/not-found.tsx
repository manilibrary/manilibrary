import Link from "next/link";

import { MEMBER_MEMBERSHIP_PATH } from "@/lib/auth-landing";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-5 py-16 text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-azure-600">
        404 · Lost page
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl">
        We couldn&apos;t find that page.
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-600">
        The link may be old, or the page may have moved. Try one of these:
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-azure-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-azure-600"
        >
          Go home
        </Link>
        <Link
          href="/membership"
          className="rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
        >
          Explore membership
        </Link>
        <Link
          href={MEMBER_MEMBERSHIP_PATH}
          className="rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
        >
          Your membership
        </Link>
      </div>
    </div>
  );
}
