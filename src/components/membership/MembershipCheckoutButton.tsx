"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { MEMBER_MEMBERSHIP_PATH } from "@/lib/auth-landing";
import { createClient } from "@/lib/supabase/client";
import { formatPhoneForRazorpayPrefill } from "@/lib/payments/razorpay-prefill";
import type { MembershipPlanKind } from "@/lib/payments/pricing";
import { planTitle, TEST_AMOUNT_RUPEES } from "@/lib/payments/pricing";

type RazorpayFail = { error?: { description?: string } };

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
  on: (event: "payment.failed", handler: (response: RazorpayFail) => void) => void;
};

export default function MembershipCheckoutButton({
  planKind,
  seatNumber,
  disabled,
  membershipStartDate,
  durationKey,
  durationLabel,
}: {
  planKind: MembershipPlanKind;
  seatNumber: number | null;
  disabled?: boolean;
  membershipStartDate: string;
  durationKey: string;
  durationLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "creating" | "modal">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const amountInr = TEST_AMOUNT_RUPEES[planKind].toFixed(0);

  const pay = useCallback(async () => {
    setErr(null);
    setMsg(null);
    if (seatNumber == null) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(pathname ?? "/membership")}`);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, email")
      .eq("user_id", user.id)
      .maybeSingle();

    const prefillEmail = user.email ?? profile?.email ?? undefined;
    const prefillContact =
      formatPhoneForRazorpayPrefill(profile?.phone) ??
      formatPhoneForRazorpayPrefill(user.phone) ??
      formatPhoneForRazorpayPrefill(user.user_metadata?.phone as string | undefined);

    setPhase("creating");
    try {
      const res = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planKind,
          seatNumber,
          membershipStartDate,
          durationKey,
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not start checkout.");
      }

      const keyId = data.keyId as string;
      const orderId = data.orderId as string;
      const amount = data.amount as number;
      const currency = data.currency as string;
      const paymentId = data.paymentId as string;

      await loadRazorpayScript();
      const Razorpay = (window as unknown as { Razorpay: RazorpayConstructor }).Razorpay;

      setPhase("modal");
      await new Promise<void>((resolve, reject) => {
        const finishModal = () => setPhase("idle");

        const checkoutOptions: Record<string, unknown> = {
          key: keyId,
          amount,
          currency,
          name: "Mani Library",
          description: `${planTitle(planKind, durationLabel)} · seat ${seatNumber}`,
          order_id: orderId,
          handler: (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            void (async () => {
              try {
                const v = await fetch("/api/payments/razorpay/verify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    payment_id: paymentId,
                  }),
                });
                let vj = (await v.json()) as { error?: string; ok?: boolean; alreadyPaid?: boolean };
                if (!v.ok && response.razorpay_payment_id?.startsWith("pay_")) {
                  const r2 = await fetch("/api/payments/razorpay/reconcile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ razorpay_payment_id: response.razorpay_payment_id }),
                  });
                  const j2 = (await r2.json()) as { error?: string; ok?: boolean; alreadyPaid?: boolean };
                  if (r2.ok && j2.ok) {
                    vj = { ok: true, alreadyPaid: j2.alreadyPaid };
                  }
                }
                if (!v.ok && !vj.ok) throw new Error(vj.error ?? "Verification failed.");
                setMsg(
                  vj.alreadyPaid
                    ? "Payment already recorded. Membership should be active."
                    : "Payment successful. Membership is now active (test mode).",
                );
                router.replace(`${MEMBER_MEMBERSHIP_PATH}?paid=1`);
                resolve();
              } catch (e) {
                reject(e instanceof Error ? e : new Error("Verify failed"));
              } finally {
                finishModal();
              }
            })();
          },
          modal: {
            ondismiss: () => {
              finishModal();
              resolve();
            },
          },
          prefill: {
            ...(prefillEmail ? { email: prefillEmail } : {}),
            ...(prefillContact ? { contact: prefillContact } : {}),
            name:
              (user.user_metadata?.full_name as string | undefined) ??
              user.email?.split("@")[0] ??
              "Member",
          },
          theme: { color: "#0ea5e9" },
        };

        if (prefillEmail && prefillContact) {
          checkoutOptions.method = "card";
        }

        // Do not set callback_url here: Razorpay often redirects to it after “Success” without
        // appending razorpay_* query params, which leaves users on /membership/payment-complete
        // with a broken URL while the DB stays pending. The handler above runs verify/reconcile
        // in-page for modal card flows. (Bank / 3DS redirects may need a callback_url — add back
        // with a hosted return page if you enable those methods in production.)

        const rzp = new Razorpay(checkoutOptions);

        rzp.on("payment.failed", (response: RazorpayFail) => {
          finishModal();
          reject(new Error(response.error?.description ?? "Payment failed."));
        });

        rzp.open();
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Payment failed.");
      setPhase("idle");
    }
  }, [planKind, seatNumber, router, pathname, membershipStartDate, durationKey, durationLabel]);

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      {err ? (
        <p className="max-w-md text-right text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="max-w-md text-right text-sm text-emerald-700" role="status">
          {msg}
        </p>
      ) : null}
      <p className="text-right text-xs text-ink-500">
        Test checkout: ₹{amountInr} · Razorpay test keys
      </p>
      <p className="max-w-md text-right text-xs leading-relaxed text-ink-500">
        If you see a <strong className="font-medium">UPI QR</strong>, you usually <strong className="font-medium">do not</strong> scan it with a real
        PhonePe/GPay in <strong className="font-medium">test mode</strong> — it won&apos;t complete. Tap{" "}
        <strong className="font-medium">Card</strong> and use Razorpay&apos;s{" "}
        <a
          href="https://razorpay.com/docs/payments/payments/test-card-upi-details/"
          className="text-azure-600 underline hover:text-azure-700"
          target="_blank"
          rel="noreferrer"
        >
          test card numbers
        </a>
        . With email + phone on your profile, checkout opens on <strong className="font-medium">Card</strong> first.
        Close the modal to cancel.
      </p>
      <button
        type="button"
        disabled={disabled || seatNumber == null || phase !== "idle"}
        onClick={() => void pay()}
        className="inline-flex items-center justify-center rounded-full bg-azure-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-azure-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {phase === "creating"
          ? "Starting…"
          : phase === "modal"
            ? "Payment window open…"
            : "Pay with Razorpay (test)"}
      </button>
    </div>
  );
}
