import { Suspense } from "react";

import MemberMyMembershipPage from "@/components/dashboard/MemberMyMembershipPage";

export const metadata = { title: "My membership" };

export default function MyMembershipRoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-600">Loading…</p>}>
      <MemberMyMembershipPage />
    </Suspense>
  );
}
