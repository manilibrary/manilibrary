import { revalidatePath } from "next/cache";

import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import {
  HERO_TAGLINE_MAX,
  HERO_TAGLINE_SUB_MAX,
  type HeroSlot,
  heroSlotColumnPrefix,
} from "@/lib/hero/constants";
import {
  heroGalleryIdColumn,
  heroGalleryIdUsedOnOtherSlot,
  type HeroGalleryRow,
} from "@/lib/hero/hero-gallery";
import {
  galleryUrlMapForHeroRow,
  HERO_SETTINGS_SELECT,
  resolveHeroImageUrls,
  type HeroRow,
} from "@/lib/hero/hero-settings";
import {
  HERO_PLACEHOLDER_BY_KEY,
  isHeroPlaceholderUrl,
  type HeroPlaceholderKey,
} from "@/lib/hero/hero-placeholders";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

function parseSlot(raw: unknown): HeroSlot | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (n === 1 || n === 2 || n === 3) return n;
  return null;
}

function parseGalleryImageId(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw === "") return null;
  return undefined;
}

function parsePlaceholderKey(raw: unknown): HeroPlaceholderKey | null | undefined {
  if (raw === null) return null;
  if (typeof raw === "string" && raw.trim()) {
    const k = raw.trim() as HeroPlaceholderKey;
    return HERO_PLACEHOLDER_BY_KEY[k] ? k : undefined;
  }
  if (raw === "") return null;
  return undefined;
}

function heroImageSrcUsedOnOtherSlot(row: HeroRow, slot: HeroSlot, src: string): boolean {
  for (const s of [1, 2, 3] as const) {
    if (s === slot) continue;
    const prefix = heroSlotColumnPrefix(s);
    const url = row[`${prefix}_image_url` as keyof HeroRow] as string | null;
    if (url === src) return true;
  }
  return false;
}

async function loadHeroRow(admin: ReturnType<typeof createSupabaseServiceRoleClient>) {
  const { data, error } = await admin
    .from("library_settings")
    .select(HERO_SETTINGS_SELECT)
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return data as HeroRow | null;
}

export async function GET(request: Request) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) return apiError(gate.message, gate.status);

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  try {
    const row = await loadHeroRow(admin);
    const urlMap = await galleryUrlMapForHeroRow(admin, row);
    return apiSuccess("OK.", { hero: resolveHeroImageUrls(row, urlMap) });
  } catch (e) {
    return apiErrorSafe(e, 500);
  }
}

export async function PATCH(request: Request) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) return apiError(gate.message, gate.status);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const slot = parseSlot(body.slot);
  if (!slot) return apiError("slot must be 1, 2, or 3.", 400);

  const tagline =
    typeof body.tagline === "string" ? body.tagline.trim() || null : body.tagline === null ? null : undefined;
  const taglineSub =
    typeof body.taglineSub === "string"
      ? body.taglineSub.trim() || null
      : body.taglineSub === null
        ? null
        : undefined;
  const galleryImageId = parseGalleryImageId(body.galleryImageId);
  const placeholderKey = parsePlaceholderKey(body.placeholderKey);

  if (
    tagline === undefined &&
    taglineSub === undefined &&
    galleryImageId === undefined &&
    placeholderKey === undefined
  ) {
    return apiError("Provide tagline, taglineSub, galleryImageId, and/or placeholderKey.", 400);
  }
  if (tagline && tagline.length > HERO_TAGLINE_MAX) {
    return apiError(`Tagline must be ${HERO_TAGLINE_MAX} characters or fewer.`, 400);
  }
  if (taglineSub && taglineSub.length > HERO_TAGLINE_SUB_MAX) {
    return apiError(`Subtitle must be ${HERO_TAGLINE_SUB_MAX} characters or fewer.`, 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  let current: HeroRow | null;
  try {
    current = await loadHeroRow(admin);
  } catch (e) {
    return apiErrorSafe(e, 500);
  }

  const prefix = heroSlotColumnPrefix(slot);
  const patch: Record<string, string | null> = { updated_at: new Date().toISOString() };

  const slotImageUrl = current
    ? ((current[`${prefix}_image_url` as keyof HeroRow] as string | null) ?? null)
    : null;
  const slotIsPlaceholder = isHeroPlaceholderUrl(slotImageUrl) !== null;

  if ((tagline !== undefined || taglineSub !== undefined) && slotIsPlaceholder && placeholderKey === undefined) {
    return apiError("Taglines are fixed for placeholder images.", 400);
  }

  if (tagline !== undefined) patch[`${prefix}_tagline`] = tagline;
  if (taglineSub !== undefined) patch[`${prefix}_tagline_sub`] = taglineSub;

  if (galleryImageId !== undefined && galleryImageId !== null) {
    if (current && heroGalleryIdUsedOnOtherSlot(current, slot, galleryImageId)) {
      return apiError("That gallery image is already used on another hero slot.", 400);
    }

    const { data: img, error: imgErr } = await admin
      .from("gallery_images")
      .select("id, public_url")
      .eq("id", galleryImageId)
      .is("deleted_at", null)
      .maybeSingle();

    if (imgErr) return apiErrorSafe(imgErr, 500);
    if (!img) return apiError("Gallery image not found.", 404);

    patch[`${prefix}_gallery_image_id`] = galleryImageId;
    patch[`${prefix}_image_url`] = img.public_url;
  } else if (placeholderKey !== undefined && placeholderKey !== null) {
    const ph = HERO_PLACEHOLDER_BY_KEY[placeholderKey];
    if (current && heroImageSrcUsedOnOtherSlot(current, slot, ph.src)) {
      return apiError("That image is already used on another hero slot.", 400);
    }
    patch[`${prefix}_gallery_image_id`] = null;
    patch[`${prefix}_image_url`] = ph.src;
    patch[`${prefix}_tagline`] = ph.tagline;
    patch[`${prefix}_tagline_sub`] = ph.taglineSub;
  } else if (galleryImageId === null || placeholderKey === null) {
    patch[`${prefix}_gallery_image_id`] = null;
    patch[`${prefix}_image_url`] = null;
  }

  const { error } = await admin
    .from("library_settings")
    .upsert({ id: 1, ...patch }, { onConflict: "id" });
  if (error) {
    if (error.code === "23505") {
      return apiError("That gallery image is already used on another hero slot.", 400);
    }
    return apiErrorSafe(error, 400);
  }

  try {
    const row = await loadHeroRow(admin);
    const urlMap = await galleryUrlMapForHeroRow(admin, row);
    revalidatePath("/");
    return apiSuccess("Hero updated.", { hero: resolveHeroImageUrls(row, urlMap) });
  } catch (e) {
    return apiErrorSafe(e, 500);
  }
}
