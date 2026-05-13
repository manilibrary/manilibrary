import { apiError, apiSuccess } from "@/lib/api/json-response";
import { formatProfileMemberLabel } from "@/lib/membership/profile-label";
import { requireLibrarySuperAdmin } from "@/lib/supabase/require-library-super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireLibrarySuperAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error.";
    return apiError(msg, 503);
  }

  let query = admin
    .from("memberships")
    .select(
      "id, user_id, plan_kind, status, seat_number, starts_at, ends_at, valid_from, valid_until, notes, payment_id, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (/^\d{1,4}$/.test(q)) {
    const n = parseInt(q, 10);
    const { data: profs } = await admin.from("profiles").select("user_id").eq("device_user_id", n).limit(20);
    const ids = (profs ?? []).map((p) => p.user_id);
    if (ids.length > 0) {
      query = admin
        .from("memberships")
        .select(
          "id, user_id, plan_kind, status, seat_number, starts_at, ends_at, valid_from, valid_until, notes, payment_id, created_at, updated_at",
        )
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(200);
    } else {
      return apiSuccess("No memberships found for that device user id.", { items: [] });
    }
  }

  const { data: items, error } = await query;
  if (error) {
    return apiError(error.message, 500);
  }

  const userIds = Array.from(new Set((items ?? []).map((r) => r.user_id).filter(Boolean)));
  const labelByUser: Record<string, string> = {};
  const deviceByUser: Record<string, number> = {};
  if (userIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("user_id, full_name, device_user_id, email")
      .in("user_id", userIds);
    for (const p of profs ?? []) {
      labelByUser[p.user_id] = formatProfileMemberLabel(p);
      deviceByUser[p.user_id] = p.device_user_id;
    }
  }

  const mapped = (items ?? []).map((r) => ({
    ...r,
    member_label: labelByUser[r.user_id] ?? r.user_id,
    device_user_id: deviceByUser[r.user_id] ?? null,
  }));

  return apiSuccess(`Loaded ${mapped.length} membership row(s) for superadmin.`, { items: mapped });
}
