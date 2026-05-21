import { randomUUID } from "crypto";

import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import {
  GALLERY_MAX_IMAGES,
  GALLERY_STORAGE_BUCKET,
  GALLERY_UPLOAD_MAX_BYTES,
  galleryPublicObjectUrl,
  isAllowedGalleryMime,
} from "@/lib/gallery/constants";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) return apiError(gate.message, gate.status);

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const { count, error: countErr } = await admin
    .from("gallery_images")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);

  if (countErr) return apiErrorSafe(countErr, 500);
  if ((count ?? 0) >= GALLERY_MAX_IMAGES) {
    return apiError(`Gallery is full (${GALLERY_MAX_IMAGES} images max). Delete some photos first.`, 400);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Expected multipart form data.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return apiError("Missing image file.", 400);
  }

  const ct = file.type?.toLowerCase() ?? "";
  if (!isAllowedGalleryMime(ct)) {
    return apiError("Use JPG, PNG, or WebP.", 400);
  }
  if (file.size > GALLERY_UPLOAD_MAX_BYTES) {
    return apiError("Image must be 5 MB or smaller.", 400);
  }

  const ext = ct === "image/png" ? "png" : ct === "image/webp" ? "webp" : "jpg";
  const storagePath = `${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from(GALLERY_STORAGE_BUCKET).upload(storagePath, buf, {
    contentType: ct,
    upsert: false,
  });
  if (upErr) {
    return apiErrorSafe(upErr, 502, "Could not upload image.", {
      hint: 'Ensure the public Storage bucket "gallery" exists.',
    });
  }

  const { data: urlData } = admin.storage.from(GALLERY_STORAGE_BUCKET).getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl || galleryPublicObjectUrl(storagePath);

  const { data: maxRow } = await admin
    .from("gallery_images")
    .select("sort_order")
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data: row, error: insErr } = await admin
    .from("gallery_images")
    .insert({
      storage_path: storagePath,
      public_url: publicUrl,
      content_type: ct,
      sort_order: sortOrder,
      uploaded_by: gate.userId,
    })
    .select("id, public_url, sort_order, created_at")
    .maybeSingle();

  if (insErr || !row) {
    await admin.storage.from(GALLERY_STORAGE_BUCKET).remove([storagePath]);
    return apiErrorSafe(insErr ?? new Error("Insert failed"), 400);
  }

  return apiSuccess("Image added to gallery.", {
    image: {
      id: row.id,
      url: row.public_url,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
    },
    count: (count ?? 0) + 1,
    maxImages: GALLERY_MAX_IMAGES,
  });
}
