import { Suspense } from "react";

import MemberMyMembershipPage from "@/components/dashboard/MemberMyMembershipPage";
import { MemberMembershipCardsSkeleton } from "@/components/ui/ContentSkeletons";

export const metadata = { title: "My membership" };

export default function MyMembershipRoutePage() {
  return (
    <Suspense fallback={<MemberMembershipCardsSkeleton />}>
      <MemberMyMembershipPage />
    </Suspense>
  );
}
