"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { MEMBER_MEMBERSHIP_PATH } from "@/lib/auth-landing";
import { buildCheckoutFingerprint, type ResumableCheckoutPayload } from "@/lib/membership/resumable-checkout";
import { flushMembershipIntakeDraftAfterPayment } from "@/lib/membership/membership-intake-draft";
import { createClient } from "@/lib/supabase/client";
import { formatPhoneForRazorpayPrefill } from "@/lib/payments/razorpay-prefill";
import type { MembershipPlanKind } from "@/lib/payments/pricing";
import { computeOrderAmountRupees, planTitle, TEST_AMOUNT_RUPEES } from "@/lib/payments/pricing";

type RazorpayFail = { error?: { description?: string; code?: string; source?: string; step?: string } };

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
  fullWidth,
  quietFooter,
  quotedAmountRupees,
  resumeCheckout = null,
}: {
  planKind: MembershipPlanKind;
  seatNumber: number | null;
  disabled?: boolean;
  membershipStartDate: string;
  durationKey: string;
  durationLabel: string;
  /** Stretch button on narrow pay step */
  fullWidth?: boolean;
  /** Hide long Razorpay test hints (show in parent disclosure instead) */
  quietFooter?: boolean;
  /** Optional display override; otherwise derived from plan + duration whitelist */
  quotedAmountRupees?: number;
  /** When fingerprint matches current seat/dates/duration, reuse existing Razorpay order (no new create-order). */
  resumeCheckout?: Pick<
    ResumableCheckoutPayload,
    "paymentId" | "orderId" | "amount" | "currency" | "keyId" | "fingerprint"
  > | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "creating" | "modal">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const displayRupees =
    quotedAmountRupees ?? computeOrderAmountRupees(planKind, durationKey) ?? TEST_AMOUNT_RUPEES[planKind];
  const amountInr = displayRupees.toLocaleString("en-IN", { maximumFractionDigits: 0 });

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
      const fingerprint = buildCheckoutFingerprint({
        planKind,
        seatNumber,
        membershipStartDate,
        durationKey,
      });
      const rc = resumeCheckout;
      const useResume = rc != null && rc.fingerprint === fingerprint && seatNumber != null;

      let keyId: string;
      let orderId: string;
      let amount: number;
      let currency: string;
      let paymentId: string;

      if (useResume && rc) {
        keyId = rc.keyId;
        orderId = rc.orderId;
        amount = rc.amount;
        currency = rc.currency;
        paymentId = rc.paymentId;
      } else {
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

        keyId = data.keyId as string;
        orderId = data.orderId as string;
        amount = data.amount as number;
        currency = data.currency as string;
        paymentId = data.paymentId as string;
      }

      await loadRazorpayScript();
      const Razorpay = (window as unknown as { Razorpay: RazorpayConstructor }).Razorpay;

      setPhase("modal");
      await new Promise<void>((resolve, reject) => {
        const finishModal = () => setPhase("idle");
        let abandonTimer: number | null = null;
        const cancelAbandonTimer = () => {
          if (abandonTimer != null) {
            window.clearTimeout(abandonTimer);
            abandonTimer = null;
          }
        };

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
                cancelAbandonTimer();
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
                await flushMembershipIntakeDraftAfterPayment();
                setMsg(
                  vj.alreadyPaid
                    ? "Payment already recorded. Membership should be active."
                    : "Payment successful. Membership is now active (test mode).",
                );
                router.replace(`${MEMBER_MEMBERSHIP_PATH}?paid=1`);
                resolve();
              } catch (e) {
                cancelAbandonTimer();
                void fetch("/api/payments/razorpay/abandon-pending-checkout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "same-origin",
                  body: JSON.stringify({ payment_id: paymentId }),
                }).catch(() => {});
                reject(e instanceof Error ? e : new Error("Verify failed"));
              } finally {
                finishModal();
              }
            })();
          },
          modal: {
            ondismiss: () => {
              abandonTimer = window.setTimeout(() => {
                abandonTimer = null;
                void fetch("/api/payments/razorpay/abandon-pending-checkout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "same-origin",
                  body: JSON.stringify({ payment_id: paymentId }),
                }).catch(() => {});
              }, 2500);
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
          cancelAbandonTimer();
          finishModal();
          const errBody = response.error;
          void fetch("/api/payments/razorpay/mark-checkout-failed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              payment_id: paymentId,
              error: errBody
                ? {
                    description: errBody.description,
                    code: errBody.code,
                    source: errBody.source,
                    step: errBody.step,
                  }
                : undefined,
            }),
          }).catch(() => {});
          reject(new Error(response.error?.description ?? "Payment failed."));
        });

        rzp.open();
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Payment failed.");
      setPhase("idle");
    }
  }, [planKind, seatNumber, router, pathname, membershipStartDate, durationKey, durationLabel, resumeCheckout]);

  return (
    <div
      className={`flex w-full flex-col gap-2 ${fullWidth ? "items-stretch" : "sm:w-auto sm:items-end"}`}
    >
      {err ? (
        <p className={`text-sm text-red-600 ${fullWidth ? "" : "max-w-md text-right"}`} role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className={`text-sm text-emerald-700 ${fullWidth ? "" : "max-w-md text-right"}`} role="status">
          {msg}
        </p>
      ) : null}
      {!quietFooter ? (
        <>
          <p className={`text-xs text-ink-500 ${fullWidth ? "" : "text-right"}`}>
            Test checkout: ₹{amountInr} · Razorpay test keys
          </p>
          <p className={`text-xs leading-relaxed text-ink-500 ${fullWidth ? "" : "max-w-md text-right"}`}>
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
        </>
      ) : (
        <p className={`text-xs text-ink-500 ${fullWidth ? "" : "text-right"}`}>Test mode · ₹{amountInr}</p>
      )}
      <button
        type="button"
        disabled={disabled || seatNumber == null || phase !== "idle"}
        onClick={() => void pay()}
        className={`inline-flex items-center justify-center rounded-full bg-azure-500 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-azure-600 disabled:cursor-not-allowed disabled:opacity-50 sm:py-3 ${
          fullWidth ? "w-full min-h-12" : ""
        }`}
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
