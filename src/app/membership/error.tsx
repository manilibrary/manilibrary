"use client";

import Link from "next/link";
import { useEffect } from "react";

import { MEMBER_MEMBERSHIP_PATH } from "@/lib/auth-landing";

export default function MembershipError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined" && "console" in window) {
      console.error("[membership-error]", error);
    }
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 md:px-8">
      <p className="font-mono text-[10px] uppercase tracking-widest text-azure-600">
        Membership · Something went wrong
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900 md:text-3xl">
        We couldn&apos;t load the seat map right now.
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-600">
        Your internet or our server may have hiccupped. Please retry. If you&apos;re mid-payment
        and not sure whether it went through, head to{" "}
        <Link href={MEMBER_MEMBERSHIP_PATH} className="font-medium text-azure-600 hover:text-azure-700">
          Your membership
        </Link>{" "}
        and use <em>Recover payment</em> with your <span className="font-mono">pay_…</span> id.
      </p>
      {error.message ? (
        <p className="mt-4 break-words rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 font-mono text-xs text-ink-700">
          {error.message}
          {error.digest ? <span className="ml-1 text-ink-400">· {error.digest}</span> : null}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-azure-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-azure-600"
        >
          Try again
        </button>
        <Link
          href="/membership"
          className="rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
        >
          Membership home
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
