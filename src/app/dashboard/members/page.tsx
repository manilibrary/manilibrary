import PageHeader from "@/components/dashboard/PageHeader";
import StaffMembershipsPanel from "@/components/dashboard/StaffMembershipsPanel";

export const metadata = { title: "Members" };

export default function MembersPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="members"
        title="Members"
        description="Recent memberships. This page is only for library staff with admin access."
      />
      <StaffMembershipsPanel />
    </div>
  );
}
