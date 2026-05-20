import Link from "next/link";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { MembershipHubRouteSkeleton } from "@/components/ui/ContentSkeletons";

const MembershipHubClient = dynamic(
  () => import("@/components/membership/MembershipHubClient"),
  { loading: () => <MembershipHubRouteSkeleton /> },
);

export const metadata = {
  title: "Membership & seats",
};

export default function MembershipHubPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6 md:max-w-xl md:px-8 md:py-12">
      <nav className="mb-6 hidden text-sm md:block">
        <Link href="/" className="inline-flex items-center text-azure-600 hover:text-azure-700">
          ← Home
        </Link>
      </nav>

      <Suspense fallback={<MembershipHubRouteSkeleton />}>
        <MembershipHubClient />
      </Suspense>
    </div>
  );
}
