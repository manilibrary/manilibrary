export const HERO_STORAGE_BUCKET =
  process.env.HERO_STORAGE_BUCKET?.trim() ||
  process.env.GALLERY_STORAGE_BUCKET?.trim() ||
  "gallery";

export const HERO_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const HERO_TAGLINE_MAX = 80;
export const HERO_TAGLINE_SUB_MAX = 120;

export const HERO_SLOTS = [1, 2, 3] as const;
export type HeroSlot = (typeof HERO_SLOTS)[number];

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isAllowedHeroMime(type: string): boolean {
  return ALLOWED.has(type.toLowerCase());
}

export function heroPublicObjectUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  return `${base}/storage/v1/object/public/${HERO_STORAGE_BUCKET}/${storagePath}`;
}

export function heroPathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/object/public/${HERO_STORAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length));
}

export function heroSlotColumnPrefix(slot: HeroSlot): "hero_1" | "hero_2" | "hero_3" {
  if (slot === 1) return "hero_1";
  if (slot === 2) return "hero_2";
  return "hero_3";
}
