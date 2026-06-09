import type { HeroSlot } from "@/lib/hero/constants";
import { heroGalleryIdColumn, type HeroGalleryRow } from "@/lib/hero/hero-gallery";
import { HERO_PLACEHOLDER_BY_KEY, isHeroPlaceholderUrl } from "@/lib/hero/hero-placeholders";
import type { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export type HeroSlotPublic = {
  slot: HeroSlot;
  galleryImageId: string | null;
  imageUrl: string | null;
  tagline: string | null;
  taglineSub: string | null;
};

export type PublicHeroSettings = {
  slots: HeroSlotPublic[];
};

export type HeroRow = HeroGalleryRow & {
  hero_1_image_url: string | null;
  hero_1_tagline: string | null;
  hero_1_tagline_sub: string | null;
  hero_2_image_url: string | null;
  hero_2_tagline: string | null;
  hero_2_tagline_sub: string | null;
  hero_3_image_url: string | null;
  hero_3_tagline: string | null;
  hero_3_tagline_sub: string | null;
};

export const HERO_SETTINGS_SELECT =
  "hero_1_gallery_image_id, hero_1_image_url, hero_1_tagline, hero_1_tagline_sub, hero_2_gallery_image_id, hero_2_image_url, hero_2_tagline, hero_2_tagline_sub, hero_3_gallery_image_id, hero_3_image_url, hero_3_tagline, hero_3_tagline_sub";

export async function galleryUrlMapForHeroRow(
  admin: ReturnType<typeof createSupabaseServiceRoleClient>,
  row: HeroRow | null,
): Promise<Map<string, string>> {
  const ids = [
    row?.hero_1_gallery_image_id,
    row?.hero_2_gallery_image_id,
    row?.hero_3_gallery_image_id,
  ].filter((id): id is string => Boolean(id));

  if (ids.length === 0) return new Map();

  const { data } = await admin
    .from("gallery_images")
    .select("id, public_url")
    .in("id", ids)
    .is("deleted_at", null);

  return new Map((data ?? []).map((g) => [g.id, g.public_url]));
}

function heroSlotPrefix(slot: HeroSlot): "hero_1" | "hero_2" | "hero_3" {
  return slot === 1 ? "hero_1" : slot === 2 ? "hero_2" : "hero_3";
}

function resolveHeroSlotTaglines(
  row: HeroRow | null,
  slot: HeroSlot,
  imageUrl: string | null,
): { tagline: string | null; taglineSub: string | null } {
  const prefix = heroSlotPrefix(slot);
  const storedUrl = (row?.[`${prefix}_image_url` as keyof HeroRow] as string | null) ?? null;
  const phKey = isHeroPlaceholderUrl(imageUrl) ?? isHeroPlaceholderUrl(storedUrl);
  if (phKey) {
    const ph = HERO_PLACEHOLDER_BY_KEY[phKey];
    return { tagline: ph.tagline, taglineSub: ph.taglineSub };
  }
  return {
    tagline: (row?.[`${prefix}_tagline` as keyof HeroRow] as string | null) ?? null,
    taglineSub: (row?.[`${prefix}_tagline_sub` as keyof HeroRow] as string | null) ?? null,
  };
}

export function resolveHeroImageUrls(
  row: HeroRow | null,
  galleryUrlById: Map<string, string>,
): PublicHeroSettings {
  const urlFor = (slot: HeroSlot): string | null => {
    if (!row) return null;
    const prefix = heroSlotPrefix(slot);
    const stored = (row[`${prefix}_image_url` as keyof HeroRow] as string | null) ?? null;
    const id = row[heroGalleryIdColumn(slot)];
    if (id) return galleryUrlById.get(id) ?? stored;
    return stored;
  };

  const slotPublic = (slot: HeroSlot): HeroSlotPublic => {
    const imageUrl = urlFor(slot);
    const { tagline, taglineSub } = resolveHeroSlotTaglines(row, slot, imageUrl);
    const prefix = heroSlotPrefix(slot);
    return {
      slot,
      galleryImageId: (row?.[`${prefix}_gallery_image_id` as keyof HeroRow] as string | null) ?? null,
      imageUrl,
      tagline,
      taglineSub,
    };
  };

  return {
    slots: [slotPublic(1), slotPublic(2), slotPublic(3)],
  };
}
