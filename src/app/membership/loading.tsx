import { MembershipHubRouteSkeleton } from "@/components/ui/ContentSkeletons";

export default function MembershipLoading() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6 md:max-w-xl md:px-8 md:py-12">
      <MembershipHubRouteSkeleton />
    </div>
  );
}
