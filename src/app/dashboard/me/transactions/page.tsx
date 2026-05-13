import { Suspense } from "react";

import MemberTransactionsPage from "@/components/dashboard/MemberTransactionsPage";
import { TransactionsTableSkeleton } from "@/components/ui/ContentSkeletons";

export const metadata = { title: "Payment history" };

export default function MemberTransactionsRoutePage() {
  return (
    <Suspense fallback={<TransactionsTableSkeleton />}>
      <MemberTransactionsPage />
    </Suspense>
  );
}
