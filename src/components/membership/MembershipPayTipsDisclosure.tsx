"use client";

import { useId, useState } from "react";

export default function MembershipPayTipsDisclosure() {
  const id = useId();
  const panelId = `${id}-paytips`;
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-ink-100 bg-white text-sm text-ink-600 shadow-sm">
      <button
        type="button"
        className="flex w-full min-h-12 items-center justify-between gap-3 px-4 py-3 text-left font-semibold text-ink-800"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span>Razorpay test payment tips</span>
        <span className="font-mono text-xs text-azure-600" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? (
        <div id={panelId} className="border-t border-ink-100 px-4 pb-4 pt-3 text-xs leading-relaxed text-ink-600">
          <p>
            If you see a <strong className="font-medium text-ink-800">UPI QR</strong>, do not scan it with a real wallet in{" "}
            <strong className="font-medium text-ink-800">test mode</strong>. Choose <strong className="font-medium text-ink-800">Card</strong> and use{" "}
            <a
              href="https://razorpay.com/docs/payments/payments/test-card-upi-details/"
              className="font-medium text-azure-600 underline hover:text-azure-700"
              target="_blank"
              rel="noreferrer"
            >
              Razorpay test cards
            </a>
            . With email and phone on your profile, checkout often opens on Card first. Close the Razorpay window to cancel.
          </p>
        </div>
      ) : null}
    </div>
  );
}
