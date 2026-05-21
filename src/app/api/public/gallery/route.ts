import { apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET() {
  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not load gallery.");
  }

  const { data, error } = await admin
    .from("gallery_images")
    .select("id, public_url, sort_order, created_at")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return apiErrorSafe(error, 500);

  const images = (data ?? []).map((r) => ({
    id: r.id,
    url: r.public_url,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }));

  return apiSuccess("OK.", { images });
}
