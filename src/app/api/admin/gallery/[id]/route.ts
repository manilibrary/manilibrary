import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { GALLERY_STORAGE_BUCKET } from "@/lib/gallery/constants";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) return apiError(gate.message, gate.status);

  const { id } = await context.params;
  if (!id?.trim()) return apiError("Missing image id.", 400);

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const { data: row, error: fetchErr } = await admin
    .from("gallery_images")
    .select("id, storage_path")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr) return apiErrorSafe(fetchErr, 500);
  if (!row) return apiError("Image not found.", 404);

  const now = new Date().toISOString();
  const { error: delErr } = await admin
    .from("gallery_images")
    .update({ deleted_at: now })
    .eq("id", id);

  if (delErr) return apiErrorSafe(delErr, 400);

  await admin.storage.from(GALLERY_STORAGE_BUCKET).remove([row.storage_path]);

  return apiSuccess("Image removed from gallery.");
}
