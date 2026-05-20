import dynamic from "next/dynamic";
import { Suspense } from "react";
import { MembershipFlowPageSkeleton } from "@/components/ui/ContentSkeletons";

const MembershipShortTermPage = dynamic(
  () => import("@/components/membership/MembershipShortTermPage"),
  { loading: () => <MembershipFlowPageSkeleton /> },
);

export const metadata = { title: "Short-term seats" };

export default function Page() {
  return (
    <Suspense fallback={<MembershipFlowPageSkeleton />}>
      <MembershipShortTermPage />
    </Suspense>
  );
}
