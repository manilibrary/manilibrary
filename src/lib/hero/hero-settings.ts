import type { HeroSlot } from "@/lib/hero/constants";
import { heroGalleryIdColumn, type HeroGalleryRow } from "@/lib/hero/hero-gallery";
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

export function resolveHeroImageUrls(
  row: HeroRow | null,
  galleryUrlById: Map<string, string>,
): PublicHeroSettings {
  const urlFor = (slot: HeroSlot): string | null => {
    if (!row) return null;
    const id = row[heroGalleryIdColumn(slot)];
    if (id) return galleryUrlById.get(id) ?? null;
    const prefix = slot === 1 ? "hero_1" : slot === 2 ? "hero_2" : "hero_3";
    return row[`${prefix}_image_url` as keyof HeroRow] as string | null;
  };

  return {
    slots: [
      {
        slot: 1,
        galleryImageId: row?.hero_1_gallery_image_id ?? null,
        imageUrl: urlFor(1),
        tagline: row?.hero_1_tagline ?? null,
        taglineSub: row?.hero_1_tagline_sub ?? null,
      },
      {
        slot: 2,
        galleryImageId: row?.hero_2_gallery_image_id ?? null,
        imageUrl: urlFor(2),
        tagline: row?.hero_2_tagline ?? null,
        taglineSub: row?.hero_2_tagline_sub ?? null,
      },
      {
        slot: 3,
        galleryImageId: row?.hero_3_gallery_image_id ?? null,
        imageUrl: urlFor(3),
        tagline: row?.hero_3_tagline ?? null,
        taglineSub: row?.hero_3_tagline_sub ?? null,
      },
    ],
  };
}
