"use client";

import type { ResumableCheckoutPayload } from "@/lib/membership/resumable-checkout";

export default function MembershipPendingCheckoutBanner({
  resume,
  durationLabel,
  onDismiss,
  dismissing,
}: {
  resume: ResumableCheckoutPayload;
  durationLabel: string;
  onDismiss: () => void | Promise<void>;
  dismissing?: boolean;
}) {
  return (
    <div
      className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm sm:px-5 sm:py-4"
      role="status"
    >
      <p className="font-semibold text-amber-950">Continue where you left off</p>
      <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
        Checkout was not finished. You are on <strong className="font-medium">Pay</strong> with seat{" "}
        <span className="font-mono font-medium">{resume.seatLabel}</span>, start date{" "}
        <span className="font-mono">{resume.membershipStartDate}</span>, {durationLabel}. Total{" "}
        <span className="font-semibold">₹{resume.amountRupees.toLocaleString("en-IN")}</span>. Use the button below
        to open Razorpay again.
      </p>
      <div className="mt-3">
        <button
          type="button"
          disabled={dismissing}
          onClick={() => void onDismiss()}
          className="text-xs font-semibold text-amber-900 underline decoration-amber-600/60 underline-offset-2 hover:text-amber-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {dismissing ? "Cancelling…" : "Start over (discard this checkout)"}
        </button>
      </div>
    </div>
  );
}
