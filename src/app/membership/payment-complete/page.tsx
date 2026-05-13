import { Suspense } from "react";

import MembershipPaymentComplete from "@/components/membership/MembershipPaymentComplete";

export const metadata = { title: "Payment complete" };

export default function MembershipPaymentCompletePage() {
  return (
    <Suspense fallback={<p className="px-5 py-16 text-center text-sm text-ink-600">Loading…</p>}>
      <MembershipPaymentComplete />
    </Suspense>
  );
}
