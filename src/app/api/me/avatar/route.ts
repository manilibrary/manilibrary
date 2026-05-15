import { randomUUID } from "crypto";

import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function bucket(): string {
  return process.env.AVATARS_STORAGE_BUCKET?.trim() || "avatars";
}

function publicObjectUrl(objectPath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  const enc = objectPath
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `${base}/storage/v1/object/public/${bucket()}/${enc}`;
}

function pathFromPublicUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  const b = bucket();
  const marker = `/object/public/${b}/`;
  const i = avatarUrl.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(avatarUrl.slice(i + marker.length));
}

export async function POST(request: Request) {
  const {
    data: { user },
    error: authErr,
  } = await getAuthUserForApiRequest(request);
  if (authErr || !user) {
    return apiError("Sign in required.", 401);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
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
  if (!ALLOWED.has(ct)) {
    return apiError("Use JPG, PNG, or WebP.", 400);
  }
  if (file.size > MAX_BYTES) {
    return apiError("Image must be 2 MB or smaller.", 400);
  }

  const ext = ct === "image/png" ? "png" : ct === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${randomUUID()}.${ext}`;

  const { data: prev } = await admin.from("profiles").select("avatar_url").eq("user_id", user.id).maybeSingle();
  const oldPath = pathFromPublicUrl(prev?.avatar_url ?? null);

  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from(bucket()).upload(path, buf, {
    contentType: ct,
    upsert: true,
  });
  if (upErr) {
    return apiErrorSafe(upErr, 502, "Could not upload avatar.", {
      hint: 'Create a public Storage bucket "avatars" (see supabase/storage-avatars-bucket.sql) or set AVATARS_STORAGE_BUCKET.',
    });
  }

  const avatarUrl = publicObjectUrl(path);

  const { error: updErr } = await admin.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", user.id);
  if (updErr) {
    await admin.storage.from(bucket()).remove([path]);
    return apiErrorSafe(updErr, 400);
  }

  if (oldPath && oldPath !== path) {
    await admin.storage.from(bucket()).remove([oldPath]);
  }

  return apiSuccess("Avatar uploaded and profile updated.", { avatarUrl });
}

export async function DELETE(request: Request) {
  const {
    data: { user },
    error: authErr,
  } = await getAuthUserForApiRequest(request);
  if (authErr || !user) {
    return apiError("Sign in required.", 401);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const { data: prev } = await admin.from("profiles").select("avatar_url").eq("user_id", user.id).maybeSingle();
  const oldPath = pathFromPublicUrl(prev?.avatar_url ?? null);

  const { error: updErr } = await admin.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
  if (updErr) {
    return apiErrorSafe(updErr, 400);
  }

  if (oldPath) {
    await admin.storage.from(bucket()).remove([oldPath]);
  }

  return apiSuccess("Avatar removed from profile and storage.");
}
