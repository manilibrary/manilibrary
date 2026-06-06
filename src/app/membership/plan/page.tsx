import dynamic from "next/dynamic";
import { Suspense } from "react";
import { MembershipFlowPageSkeleton } from "@/components/ui/ContentSkeletons";

const MembershipPlanFlow = dynamic(
  () => import("@/components/membership/MembershipPlanFlow"),
  { loading: () => <MembershipFlowPageSkeleton /> },
);

export const metadata = { title: "Choose your plan" };

export default function Page() {
  return (
    <Suspense fallback={<MembershipFlowPageSkeleton />}>
      <MembershipPlanFlow />
    </Suspense>
  );
}
