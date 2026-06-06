import { apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import {
  LIBRARY_PLANS_SELECT,
  rowToLibraryPlan,
  type LibraryPlanRow,
} from "@/lib/plans/library-plans";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET() {
  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not load plans.");
  }

  const { data, error } = await admin
    .from("library_plans")
    .select(LIBRARY_PLANS_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return apiErrorSafe(error, 500);

  const plans = (data ?? []).map((r) => rowToLibraryPlan(r as LibraryPlanRow));
  return apiSuccess("OK.", { plans });
}
