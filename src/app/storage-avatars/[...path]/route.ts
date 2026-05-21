import { NextResponse } from "next/server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const BUCKET = process.env.AVATARS_STORAGE_BUCKET?.trim() || "avatars";

function objectPathFromParams(path: string | string[] | undefined): string | null {
  if (path == null) return null;
  if (Array.isArray(path)) {
    if (!path.length) return null;
    return path.map((p) => decodeURIComponent(p)).join("/");
  }
  const s = String(path).trim();
  return s || null;
}

/** Same-origin avatar bytes (works when the public Storage URL is unavailable). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string | string[] }> },
) {
  const { path } = await context.params;
  const objectPath = objectPathFromParams(path);
  if (!objectPath) {
    return NextResponse.json({ error: "Missing path." }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Server misconfiguration." }, { status: 503 });
  }

  const { data, error } = await admin.storage.from(BUCKET).download(objectPath);
  if (error || !data) {
    return new NextResponse(null, { status: 404 });
  }

  const bytes = await data.arrayBuffer();
  const contentType = data.type || "image/jpeg";

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
    },
  });
}
