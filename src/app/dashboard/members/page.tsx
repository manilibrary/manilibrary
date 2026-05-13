import PageHeader from "@/components/dashboard/PageHeader";
import StaffMembershipsPanel from "@/components/dashboard/StaffMembershipsPanel";

export const metadata = { title: "Members" };

export default function MembersPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="members"
        title="Members"
        description="Recent memberships from Supabase (library admin only can open this page)."
      />
      <StaffMembershipsPanel />
    </div>
  );
}
