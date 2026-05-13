"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useEffect, useState } from "react";
import { MEMBER_MEMBERSHIP_PATH } from "@/lib/auth-landing";
import { createClient } from "@/lib/supabase/client";
import { PaymentCompleteSkeleton } from "@/components/ui/ContentSkeletons";

/**
 * Razorpay may redirect here (callback_url) after some flows and append
 * razorpay_payment_id, razorpay_order_id, razorpay_signature. In practice those
 * query params are often missing; we then rely on reconcile with pay_… only.
 */

function readBrowserQuery(): URLSearchParams {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search.replace(/^\?/, ""));
}

function getParam(params: URLSearchParams, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = params.get(k);
    if (v) return v.trim();
  }
  for (const [key, val] of params.entries()) {
    const lk = key.toLowerCase();
    for (const k of keys) {
      if (lk === k.toLowerCase() && val) return val.trim();
    }
  }
  return null;
}

export default function MembershipPaymentComplete() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"working" | "ok" | "err">("working");
  const [message, setMessage] = useState<string>("Confirming payment…");
  const [manualPayId, setManualPayId] = useState("");
  const [manualBusy, setManualBusy] = useState(false);

  const tryReconcile = useCallback(
    async (razorpay_payment_id: string) => {
      const trimmed = razorpay_payment_id.trim();
      if (!trimmed.startsWith("pay_")) {
        setMessage("That does not look like a Razorpay Payment ID (it should start with pay_).");
        return false;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setStatus("err");
        setMessage("Please sign in, then try again or use Your membership → Recover payment.");
        return false;
      }
      const r2 = await fetch("/api/payments/razorpay/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razorpay_payment_id: trimmed }),
      });
      const b2 = (await r2.json()) as { error?: string; ok?: boolean; alreadyPaid?: boolean };
      if (!r2.ok || !b2.ok) {
        setStatus("err");
        setMessage(b2.error ?? "Could not sync this payment to your account.");
        return false;
      }
      setStatus("ok");
      setMessage(
        b2.alreadyPaid
          ? "Payment was already recorded. Redirecting to your account…"
          : "Payment confirmed. Redirecting to your account…",
      );
      router.replace(`${MEMBER_MEMBERSHIP_PATH}?paid=1`);
      return true;
    },
    [router],
  );

  const run = useCallback(async () => {
    const fromNext = new URLSearchParams(searchParams.toString());
    const fromBrowser = readBrowserQuery();
    const params = new URLSearchParams();
    for (const [k, v] of fromNext.entries()) {
      params.set(k, v);
    }
    for (const [k, v] of fromBrowser.entries()) {
      if (!params.get(k)) params.set(k, v);
    }

    const paymentId = getParam(params, "payment_id");
    const razorpay_payment_id = getParam(params, "razorpay_payment_id");
    const razorpay_order_id = getParam(params, "razorpay_order_id");
    const razorpay_signature = getParam(params, "razorpay_signature");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStatus("err");
      setMessage("Please sign in, then return to this page or open Your membership.");
      return;
    }

    // 1) Razorpay returned pay_… — reconcile works without signature (common when URL drops sig).
    if (razorpay_payment_id?.startsWith("pay_")) {
      const ok = await tryReconcile(razorpay_payment_id);
      if (ok) return;
      if (razorpay_order_id && razorpay_signature && paymentId) {
        const res = await fetch("/api/payments/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_id: paymentId,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
          }),
        });
        let body = (await res.json()) as { error?: string; ok?: boolean; alreadyPaid?: boolean };
        if (!res.ok && razorpay_payment_id.startsWith("pay_")) {
          const r2 = await fetch("/api/payments/razorpay/reconcile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ razorpay_payment_id }),
          });
          const b2 = (await r2.json()) as { error?: string; ok?: boolean; alreadyPaid?: boolean };
          if (r2.ok && b2.ok) body = { ok: true, alreadyPaid: b2.alreadyPaid };
        }
        const settledOk = res.ok || body.ok === true;
        if (settledOk) {
          setStatus("ok");
          setMessage(
            body.alreadyPaid
              ? "Payment was already recorded. Redirecting to your account…"
              : "Payment confirmed. Redirecting to your account…",
          );
          router.replace(`${MEMBER_MEMBERSHIP_PATH}?paid=1`);
          return;
        }
      }
      return;
    }

    // 2) Full HMAC verify path when Razorpay sent everything.
    if (paymentId && razorpay_payment_id && razorpay_order_id && razorpay_signature) {
      const res = await fetch("/api/payments/razorpay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: paymentId,
          razorpay_payment_id,
          razorpay_order_id,
          razorpay_signature,
        }),
      });
      let body = (await res.json()) as { error?: string; ok?: boolean; alreadyPaid?: boolean };
      if (!res.ok && razorpay_payment_id.startsWith("pay_")) {
        const r2 = await fetch("/api/payments/razorpay/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ razorpay_payment_id }),
        });
        const b2 = (await r2.json()) as { error?: string; ok?: boolean; alreadyPaid?: boolean };
        if (r2.ok && b2.ok) body = { ok: true, alreadyPaid: b2.alreadyPaid };
      }
      const settledOk = res.ok || body.ok === true;
      if (!settledOk) {
        setStatus("err");
        setMessage(
          body.error ??
            "Verification failed. Paste your Razorpay Payment ID (pay_…) below — it is on the Razorpay success screen or in Razorpay Dashboard → Payments.",
        );
        return;
      }
      setStatus("ok");
      setMessage(
        body.alreadyPaid
          ? "Payment was already recorded. Redirecting to your account…"
          : "Payment confirmed. Redirecting to your account…",
      );
      router.replace(`${MEMBER_MEMBERSHIP_PATH}?paid=1`);
      return;
    }

    // 3) Nothing usable in URL (typical after “Success” without a proper redirect query).
    setStatus("err");
    setMessage(
      "This page did not receive Razorpay’s return parameters (often happens after Success in test mode). " +
        "Copy the Payment ID from the Razorpay receipt — it starts with pay_ — paste it below, then Sync. " +
        (paymentId
          ? `Your checkout id (for support): ${paymentId.slice(0, 8)}…`
          : ""),
    );
  }, [router, searchParams, tryReconcile]);

  useEffect(() => {
    startTransition(() => {
      void run();
    });
  }, [run]);

  return (
    <div className="mx-auto max-w-lg px-5 py-16 text-center">
      <h1 className="text-xl font-semibold text-ink-900">Payment return</h1>
      <p className="mt-4 text-sm text-ink-600">{message}</p>
      {status === "working" ? <PaymentCompleteSkeleton /> : null}
      {status === "err" ? (
        <div className="mt-8 space-y-4 text-left">
          <div className="rounded-xl border border-ink-200 bg-ink-50/80 p-4">
            <p className="text-xs font-medium text-ink-800">Paste Razorpay Payment ID</p>
            <p className="mt-1 text-xs text-ink-600">
              Razorpay Dashboard → Payments → open your payment → copy <span className="font-mono">pay_…</span>
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 font-mono text-sm"
                placeholder="pay_…"
                value={manualPayId}
                onChange={(e) => setManualPayId(e.target.value)}
              />
              <button
                type="button"
                disabled={manualBusy || !manualPayId.trim().startsWith("pay_")}
                className="rounded-full bg-azure-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
                onClick={() => {
                  setManualBusy(true);
                  void (async () => {
                    const ok = await tryReconcile(manualPayId);
                    if (ok) setManualPayId("");
                    setManualBusy(false);
                  })();
                }}
              >
                {manualBusy ? "Working…" : "Sync"}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-3 text-center">
            <Link
              href={MEMBER_MEMBERSHIP_PATH}
              className="inline-flex justify-center rounded-full bg-azure-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-azure-600"
            >
              Your membership
            </Link>
            <div className="hidden md:block">
              <Link href="/membership/long-term" className="text-sm text-azure-600 hover:text-azure-700">
                ← Back to membership
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
