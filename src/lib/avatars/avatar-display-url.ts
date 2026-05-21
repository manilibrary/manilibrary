const AVATAR_BUCKET = process.env.AVATARS_STORAGE_BUCKET?.trim() || "avatars";

/** Extract storage object path from a stored public avatar URL. */
export function avatarPathFromStoredUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  const marker = `/object/public/${AVATAR_BUCKET}/`;
  const i = avatarUrl.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(avatarUrl.slice(i + marker.length));
}

/**
 * Same-origin URL for <img> (avoids Edge/third-party image blocking on localhost).
 * DB still stores the full Supabase public URL.
 */
export function avatarDisplayUrl(avatarUrl: string | null | undefined, cacheBust?: number): string | null {
  const path = avatarPathFromStoredUrl(avatarUrl);
  if (!path) return avatarUrl ?? null;
  const base = `/storage-avatars/${path}`;
  return cacheBust ? `${base}?v=${cacheBust}` : base;
}
