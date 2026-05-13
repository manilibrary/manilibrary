import { Suspense } from "react";

import MembershipPaymentComplete from "@/components/membership/MembershipPaymentComplete";
import { PaymentCompleteSkeleton } from "@/components/ui/ContentSkeletons";

export const metadata = { title: "Payment complete" };

export default function MembershipPaymentCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-5 py-16 text-center">
          <div className="mx-auto h-7 w-48 animate-pulse rounded-lg bg-ink-100" />
          <PaymentCompleteSkeleton />
        </div>
      }
    >
      <MembershipPaymentComplete />
    </Suspense>
  );
}
