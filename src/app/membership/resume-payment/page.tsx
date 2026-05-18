import { Suspense } from "react";

import ResumeMembershipPayment from "@/components/membership/ResumeMembershipPayment";

export default function ResumePaymentPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-ink-600">Loading…</p>}>
      <ResumeMembershipPayment />
    </Suspense>
  );
}
