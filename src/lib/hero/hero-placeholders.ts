import type { HeroSlot } from "@/lib/hero/constants";

export type HeroPlaceholderKey = "outer" | "inner" | "biometric";

export type HeroPlaceholderDef = {
  key: HeroPlaceholderKey;
  src: string;
  label: string;
  tagline: string;
  taglineSub: string;
  /** Default slot this placeholder is designed for (homepage fallback). */
  defaultSlot: HeroSlot;
};

export const HERO_PLACEHOLDERS: HeroPlaceholderDef[] = [
  {
    key: "outer",
    src: "/outerPlaceholder.png",
    label: "Open 24 / 7 (placeholder)",
    tagline: "Open 24 / 7",
    taglineSub: "Study any hour, every day",
    defaultSlot: 2,
  },
  {
    key: "inner",
    src: "/innerViewPlaceholder.png",
    label: "Separate cabins (placeholder)",
    tagline: "Separate cabins",
    taglineSub: "Private, focused study spaces",
    defaultSlot: 1,
  },
  {
    key: "biometric",
    src: "/biometricPlaceholder.png",
    label: "Authorized entry (placeholder)",
    tagline: "Authorized entry",
    taglineSub: "Biometric attendance tracking",
    defaultSlot: 3,
  },
];

export const HERO_PLACEHOLDER_BY_KEY: Record<HeroPlaceholderKey, HeroPlaceholderDef> = Object.fromEntries(
  HERO_PLACEHOLDERS.map((p) => [p.key, p]),
) as Record<HeroPlaceholderKey, HeroPlaceholderDef>;

/** Synthetic picker id (not a gallery UUID). */
export const HERO_PLACEHOLDER_PICKER_PREFIX = "__hero_ph__:";

export function heroPlaceholderPickerId(key: HeroPlaceholderKey): string {
  return `${HERO_PLACEHOLDER_PICKER_PREFIX}${key}`;
}

export function parseHeroPlaceholderPickerId(id: string): HeroPlaceholderKey | null {
  if (!id.startsWith(HERO_PLACEHOLDER_PICKER_PREFIX)) return null;
  const key = id.slice(HERO_PLACEHOLDER_PICKER_PREFIX.length) as HeroPlaceholderKey;
  return HERO_PLACEHOLDER_BY_KEY[key] ? key : null;
}

export function isHeroPlaceholderUrl(url: string | null | undefined): HeroPlaceholderKey | null {
  if (!url) return null;
  const normalized = url.startsWith("http") ? new URL(url).pathname : url;
  for (const p of HERO_PLACEHOLDERS) {
    if (normalized === p.src || normalized.endsWith(p.src)) return p.key;
  }
  return null;
}

export function heroPlaceholderForSlot(slot: HeroSlot): HeroPlaceholderDef {
  return HERO_PLACEHOLDERS.find((p) => p.defaultSlot === slot) ?? HERO_PLACEHOLDERS[0];
}
