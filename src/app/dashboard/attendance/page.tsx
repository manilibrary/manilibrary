import AdminAttendancePanel from "@/components/dashboard/AdminAttendancePanel";
import EtimeAttendanceStaffPanel from "@/components/dashboard/EtimeAttendanceStaffPanel";
import PageHeader from "@/components/dashboard/PageHeader";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    try {
      const admin = createSupabaseServiceRoleClient();
      const { data } = await admin
        .from("profiles")
        .select("is_admin")
        .eq("user_id", user.id)
        .maybeSingle();
      isAdmin = data?.is_admin === true;
    } catch {
      isAdmin = false;
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="attendance"
        title="Attendance"
        description="Daily in/out from the biometric device, matched to library members by Empcode = device_user_id. Live tail below auto-refreshes every 30 seconds."
      />
      {isAdmin ? (
        <AdminAttendancePanel />
      ) : (
        <EtimeAttendanceStaffPanel isAdmin={false} />
      )}
    </div>
  );
}
