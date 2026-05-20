import dynamic from "next/dynamic";
import { Suspense } from "react";
import { MembershipFlowPageSkeleton } from "@/components/ui/ContentSkeletons";

const MembershipLongTermPage = dynamic(
  () => import("@/components/membership/MembershipLongTermPage"),
  { loading: () => <MembershipFlowPageSkeleton /> },
);

export const metadata = { title: "Long-term seats" };

export default function Page() {
  return (
    <Suspense fallback={<MembershipFlowPageSkeleton />}>
      <MembershipLongTermPage />
    </Suspense>
  );
}
