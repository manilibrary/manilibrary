"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { MEMBER_MEMBERSHIP_PATH } from "@/lib/auth-landing";
import { formatPhoneForRazorpayPrefill } from "@/lib/payments/razorpay-prefill";
import { createClient } from "@/lib/supabase/client";

function loadRazorpayScript(): Promise<void> {
  const w = window as unknown as { Razorpay?: unknown };
  if (w.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay."));
    document.body.appendChild(s);
  });
}

type RazorpayConstructor = new (options: Record<string, unknown>) => {
  open: () => void;
  on: (event: "payment.failed", handler: (r: { error?: { description?: string } }) => void) => void;
};

export default function ResumeMembershipPayment() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("payment_id")?.trim() ?? "";
  const [msg, setMsg] = useState("Loading checkout…");
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!paymentId) {
      setErr("Missing payment_id.");
      return;
    }
    setErr(null);
    try {
      const res = await fetch(
        `/api/payments/razorpay/order-checkout?payment_id=${encodeURIComponent(paymentId)}`,
        { credentials: "same-origin" },
      );
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok || data.ok !== true) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not load checkout.");
      }

      const keyId = String(data.keyId ?? "");
      const orderId = String(data.orderId ?? "");
      const amount = Number(data.amount ?? 0);
      const currency = String(data.currency ?? "INR");
      const payId = String(data.paymentId ?? paymentId);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Sign in on the website, then open this link again.");
      }

      await loadRazorpayScript();
      const Razorpay = (window as unknown as { Razorpay: RazorpayConstructor }).Razorpay;
      const prefillEmail = user.email ?? undefined;
      const phoneMeta = user.user_metadata?.phone;
      const prefillContact =
        typeof phoneMeta === "string" ? formatPhoneForRazorpayPrefill(phoneMeta) ?? undefined : undefined;

      await new Promise<void>((resolve, reject) => {
        const rzp = new Razorpay({
          key: keyId,
          amount,
          currency,
          name: "Mani Library",
          description: "Complete membership payment",
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
                  credentials: "same-origin",
                  body: JSON.stringify({
                    payment_id: payId,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  }),
                });
                let ok = v.ok;
                if (!ok && response.razorpay_payment_id.startsWith("pay_")) {
                  const sync = await fetch("/api/payments/razorpay/sync-pending", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "same-origin",
                    body: JSON.stringify({ payment_id: payId }),
                  });
                  const sj = (await sync.json()) as { ok?: boolean; outcome?: string };
                  ok = sync.ok && sj.ok === true && sj.outcome === "paid";
                }
                if (!ok) throw new Error("Could not confirm payment.");
                window.location.href = `${MEMBER_MEMBERSHIP_PATH}?paid=1`;
                resolve();
              } catch (e) {
                reject(e instanceof Error ? e : new Error("Verify failed"));
              }
            })();
          },
          modal: {
            ondismiss: () => reject(new Error("Payment closed.")),
          },
          prefill: {
            name: (user.user_metadata?.full_name as string | undefined) ?? "Member",
            ...(prefillEmail ? { email: prefillEmail } : {}),
            ...(prefillContact ? { contact: prefillContact } : {}),
          },
          theme: { color: "#0ea5e9" },
        });
        rzp.on("payment.failed", () => {
          void fetch("/api/payments/razorpay/mark-checkout-failed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ payment_id: payId }),
          });
          reject(new Error("Payment failed."));
        });
        rzp.open();
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Checkout failed.");
    }
  }, [paymentId]);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <div className="mx-auto max-w-lg px-5 py-16 text-center">
      <h1 className="text-xl font-semibold text-ink-900">Complete payment</h1>
      <p className="mt-4 text-sm text-ink-600">{err ?? msg}</p>
    </div>
  );
}
