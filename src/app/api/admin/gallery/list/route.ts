import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { GALLERY_MAX_IMAGES } from "@/lib/gallery/constants";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) return apiError(gate.message, gate.status);

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const { data, error } = await admin
    .from("gallery_images")
    .select("id, public_url, storage_path, content_type, sort_order, created_at")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return apiErrorSafe(error, 500);

  const images = (data ?? []).map((r) => ({
    id: r.id,
    url: r.public_url,
    contentType: r.content_type,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }));

  return apiSuccess("OK.", {
    images,
    count: images.length,
    maxImages: GALLERY_MAX_IMAGES,
  });
}
