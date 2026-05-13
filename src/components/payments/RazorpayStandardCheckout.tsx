"use client";

import { formatPhoneForRazorpayPrefill } from "@/lib/payments/razorpay-prefill";
import { useCallback, useState } from "react";

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("No window"));
  }
  const w = window as unknown as { Razorpay?: unknown };
  if (w.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay checkout script."));
    document.body.appendChild(s);
  });
}

type RazorpayConstructor = new (options: Record<string, unknown>) => {
  open: () => void;
  on: (event: "payment.failed", handler: (response: PaymentFailedPayload) => void) => void;
};

type PaymentFailedPayload = {
  error?: { code?: string; description?: string; source?: string; step?: string };
};

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

const DEFAULT_PAISE = 100;

export default function RazorpayStandardCheckout({
  title = "Standard checkout (test)",
  description = "Razorpay Standard Web Checkout demo",
}: {
  title?: string;
  description?: string;
}) {
  const [amountPaise, setAmountPaise] = useState(DEFAULT_PAISE);
  const [demoEmail, setDemoEmail] = useState("");
  const [demoPhone, setDemoPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const pay = useCallback(async () => {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      if (!Number.isFinite(amountPaise) || !Number.isInteger(amountPaise) || amountPaise < 100) {
        throw new Error("Amount must be an integer of at least 100 paise (₹1.00).");
      }

      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: `web_${Date.now()}`,
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not create order.");
      }

      const orderId = data.order_id as string;
      const amount = data.amount as number;
      const currency = data.currency as string;

      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!keyId) {
        throw new Error("NEXT_PUBLIC_RAZORPAY_KEY_ID is not set (publishable key id for checkout).");
      }

      await loadRazorpayScript();
      const Razorpay = (window as unknown as { Razorpay: RazorpayConstructor }).Razorpay;

      const prefillEmail = demoEmail.trim() || undefined;
      const prefillContact = formatPhoneForRazorpayPrefill(demoPhone.trim()) ?? undefined;

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (fn: () => void) => {
          if (settled) return;
          settled = true;
          fn();
        };

        const checkoutOptions: Record<string, unknown> = {
          key: keyId,
          amount,
          currency,
          name: title,
          description,
          order_id: orderId,
          handler: (response: RazorpaySuccess) => {
            void (async () => {
              try {
                const v = await fetch("/api/verify-payment", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  }),
                });
                const vj = (await v.json()) as { error?: string; ok?: boolean };
                if (!v.ok) throw new Error(vj.error ?? "Verification failed.");
                setMsg("Payment verified successfully (signature OK).");
                finish(() => resolve());
              } catch (e) {
                finish(() => reject(e instanceof Error ? e : new Error("Verify failed")));
              }
            })();
          },
          modal: {
            ondismiss: () => {
              finish(() => resolve());
            },
          },
          prefill: {
            ...(prefillEmail ? { email: prefillEmail } : {}),
            ...(prefillContact ? { contact: prefillContact } : {}),
            name: "Test user",
          },
          theme: { color: "#0ea5e9" },
        };

        if (prefillEmail && prefillContact) {
          checkoutOptions.method = "card";
        }

        const rzp = new Razorpay(checkoutOptions);

        rzp.on("payment.failed", (response: PaymentFailedPayload) => {
          const d = response?.error?.description ?? "Payment failed.";
          finish(() => reject(new Error(d)));
        });

        rzp.open();
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [amountPaise, demoEmail, demoPhone, description, title]);

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
        <p className="mt-1 text-sm text-ink-600">
          Uses POST <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">/api/create-order</code> and{" "}
          <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">/api/verify-payment</code>. Minimum ₹1.00
          (100 paise).
        </p>
      </div>

      <label className="block text-sm text-ink-700">
        Amount (paise)
        <input
          type="number"
          min={100}
          step={1}
          className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm"
          value={amountPaise}
          onChange={(e) => setAmountPaise(Number(e.target.value))}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-ink-700">
          Email (optional, for Card-first)
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
            value={demoEmail}
            onChange={(e) => setDemoEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm text-ink-700">
          Mobile (optional, +91…)
          <input
            type="tel"
            autoComplete="tel"
            placeholder="9876543210 or +919876543210"
            className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
            value={demoPhone}
            onChange={(e) => setDemoPhone(e.target.value)}
          />
        </label>
      </div>

      <p className="text-xs leading-relaxed text-ink-500">
        If checkout shows a <strong className="font-medium text-ink-700">UPI QR</strong>, don&apos;t scan it with a real UPI app in{" "}
        <strong className="font-medium text-ink-700">test mode</strong>. Fill <strong className="font-medium">email + mobile</strong> here so Razorpay
        can open the <strong className="font-medium">Card</strong> tab first, or tap <strong className="font-medium">Card</strong> manually and use{" "}
        <a
          href="https://razorpay.com/docs/payments/payments/test-card-upi-details/"
          className="text-azure-600 underline hover:text-azure-700"
          target="_blank"
          rel="noreferrer"
        >
          test card numbers
        </a>
        .
      </p>

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
          {msg}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void pay()}
        className="w-full rounded-full bg-azure-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-azure-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Processing…" : `Pay ₹${(amountPaise / 100).toFixed(2)} (test)`}
      </button>

      <p className="text-xs text-ink-500">
        If you close the modal without paying, no error is shown. Failed payments show Razorpay&apos;s message here.
      </p>
    </div>
  );
}
