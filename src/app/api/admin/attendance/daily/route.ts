import { apiError, apiSuccess } from "@/lib/api/json-response";
import { formatDateDMY } from "@/lib/etime/dates";
import { etimeErrorResponse } from "@/lib/etime/etime-route-errors";
import { loadAdminDailyAttendance } from "@/lib/etime/admin-daily-attendance";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const url = new URL(request.url);
  const fromDate = url.searchParams.get("fromDate") ?? formatDateDMY(new Date());
  const toDate = url.searchParams.get("toDate") ?? fromDate;
  const empcode = url.searchParams.get("empcode") ?? undefined;

  const admin = createSupabaseServiceRoleClient();
  const result = await loadAdminDailyAttendance(admin, { fromDate, toDate, empcode });

  if (!result.ok) {
    return etimeErrorResponse(
      new Error(
        "eTime did not respond. Verify ETIME_BASIC_USER (corp:user:pass:true) and that your account has data for this range.",
      ),
    );
  }

  return apiSuccess(`Daily attendance loaded (${result.items.length} row(s); source: ${result.source}).`, {
    fromDate: result.fromDate,
    toDate: result.toDate,
    source: result.source,
    items: result.items,
    skipped_unregistered: result.skipped,
  });
}
