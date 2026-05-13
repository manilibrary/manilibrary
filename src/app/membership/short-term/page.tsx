import { Suspense } from "react";
import MembershipShortTermPage from "@/components/membership/MembershipShortTermPage";

export const metadata = { title: "Short-term seats" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MembershipShortTermPage />
    </Suspense>
  );
}
