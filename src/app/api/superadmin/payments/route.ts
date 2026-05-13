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
  const limit = Math.min(80, Math.max(1, parseInt(url.searchParams.get("limit") ?? "40", 10) || 40));
  const status = (url.searchParams.get("status") ?? "").trim();

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error.";
    return apiError(msg, 503);
  }

  let q = admin
    .from("payments")
    .select("id, user_id, membership_id, amount_rupees, status, provider, provider_payment_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status === "pending" || status === "paid" || status === "failed" || status === "refunded") {
    q = q.eq("status", status);
  }

  const { data: rows, error } = await q;
  if (error) {
    return apiError(error.message, 500);
  }

  const userIds = [...new Set((rows ?? []).map((r) => (r as { user_id: string }).user_id))];
  const labels: Record<string, string> = {};
  const deviceByUser: Record<string, number> = {};
  if (userIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("user_id, full_name, device_user_id")
      .in("user_id", userIds);
    for (const p of profs ?? []) {
      labels[p.user_id] = formatProfileMemberLabel(p);
      deviceByUser[p.user_id] = p.device_user_id;
    }
  }

  const items = (rows ?? []).map((r) => {
    const row = r as {
      id: string;
      user_id: string;
      membership_id: string | null;
      amount_rupees: number;
      status: string;
      provider: string | null;
      provider_payment_id: string | null;
      created_at: string;
    };
    return {
      ...row,
      member_label: labels[row.user_id] ?? row.user_id,
      device_user_id: deviceByUser[row.user_id] ?? null,
    };
  });

  return apiSuccess(`Loaded ${items.length} payment row(s).`, { items });
}
