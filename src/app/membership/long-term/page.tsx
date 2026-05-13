import { Suspense } from "react";
import MembershipLongTermPage from "@/components/membership/MembershipLongTermPage";

export const metadata = { title: "Long-term seats" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MembershipLongTermPage />
    </Suspense>
  );
}
