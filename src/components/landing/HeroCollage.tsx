"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { PublicHeroSettings } from "@/lib/hero/hero-settings";
import { HERO_PLACEHOLDER_BY_KEY, heroPlaceholderForSlot, isHeroPlaceholderUrl } from "@/lib/hero/hero-placeholders";

function SlotIcon({ slot, className = "h-4 w-4 text-azure-500" }: { slot: 1 | 2 | 3; className?: string }) {
  if (slot === 1) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (slot === 2) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  );
}

type ResolvedHeroSlot = {
  src: string;
  tagline: string | null;
  taglineSub: string | null;
  onImageError: () => void;
};

function useResolvedHeroSlot(
  slot: 1 | 2 | 3,
  imageUrl: string | null,
  tagline: string | null,
  taglineSub: string | null,
): ResolvedHeroSlot {
  const [errored, setErrored] = useState(false);
  useEffect(() => setErrored(false), [imageUrl]);

  const placeholderKey = isHeroPlaceholderUrl(imageUrl);
  const placeholder = placeholderKey
    ? HERO_PLACEHOLDER_BY_KEY[placeholderKey]
    : heroPlaceholderForSlot(slot);
  const usingPlaceholder = !imageUrl || errored;
  const src = usingPlaceholder ? placeholder.src : imageUrl;

  const effectiveTagline = placeholderKey
    ? placeholder.tagline
    : tagline?.trim()
      ? tagline
      : usingPlaceholder
        ? placeholder.tagline
        : null;
  const effectiveTaglineSub = placeholderKey
    ? placeholder.taglineSub
    : taglineSub?.trim()
      ? taglineSub
      : usingPlaceholder
        ? placeholder.taglineSub
        : null;

  return {
    src,
    tagline: effectiveTagline,
    taglineSub: effectiveTaglineSub,
    onImageError: () => setErrored(true),
  };
}

function HeroTagContent({
  slot,
  tagline,
  taglineSub,
}: {
  slot: 1 | 2 | 3;
  tagline: string;
  taglineSub: string | null;
}) {
  const hasSub = Boolean(taglineSub?.trim());

  return (
    <div
      className={`flex gap-2 px-2.5 py-2 sm:gap-2.5 sm:px-3 ${hasSub ? "items-start sm:py-2.5" : "items-center sm:py-2"}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-azure-50 sm:h-9 sm:w-9 ${hasSub ? "mt-0.5" : ""}`}
      >
        <SlotIcon slot={slot} className="h-4 w-4 text-azure-500 sm:h-[1.125rem] sm:w-[1.125rem]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[clamp(0.75rem,3.2vw,0.9375rem)] font-semibold leading-snug text-ink-900">{tagline}</p>
        {hasSub ? (
          <p className="mt-0.5 text-[clamp(0.6875rem,2.8vw,0.8125rem)] leading-snug text-ink-500">{taglineSub}</p>
        ) : null}
      </div>
    </div>
  );
}

function HeroTagOverlay({
  slot,
  tagline,
  taglineSub,
  className = "inset-x-2 bottom-2",
}: {
  slot: 1 | 2 | 3;
  tagline: string;
  taglineSub: string | null;
  className?: string;
}) {
  return (
    <div
      className={`absolute z-30 ${className} rounded-xl border border-ink-100/90 bg-white/95 shadow-md backdrop-blur-sm`}
    >
      <HeroTagContent slot={slot} tagline={tagline} taglineSub={taglineSub} />
    </div>
  );
}

function HeroTagBelow({
  slot,
  tagline,
  taglineSub,
  className = "",
}: {
  slot: 1 | 2 | 3;
  tagline: string;
  taglineSub: string | null;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-[4.75rem] flex-col justify-center rounded-xl border border-ink-100 bg-white shadow-sm ${className}`}
    >
      <HeroTagContent slot={slot} tagline={tagline} taglineSub={taglineSub} />
    </div>
  );
}

function MobileHeroCard({
  slot,
  imageUrl,
  tagline,
  taglineSub,
  aspectClass,
  priority,
  imageClassName = "",
  figureClassName = "",
}: {
  slot: 1 | 2 | 3;
  imageUrl: string | null;
  tagline: string | null;
  taglineSub: string | null;
  aspectClass: string;
  priority?: boolean;
  imageClassName?: string;
  figureClassName?: string;
}) {
  const resolved = useResolvedHeroSlot(slot, imageUrl, tagline, taglineSub);

  return (
    <figure className={`flex flex-col ${figureClassName}`}>
      <div
        className={`relative overflow-hidden rounded-2xl border border-white/80 bg-ink-100 shadow-card ${aspectClass} ${imageClassName}`}
      >
        <Image
          src={resolved.src}
          alt=""
          fill
          priority={priority}
          unoptimized
          onError={resolved.onImageError}
          className="object-cover"
          sizes="(max-width: 1024px) 90vw, 420px"
        />
      </div>
      {resolved.tagline?.trim() ? (
        <HeroTagBelow className="mt-2 flex-1" slot={slot} tagline={resolved.tagline} taglineSub={resolved.taglineSub} />
      ) : null}
    </figure>
  );
}

function DesktopHeroImageCard({
  slot,
  imageUrl,
  tagline,
  taglineSub,
  className,
  imageClassName,
  priority,
}: {
  slot: 1 | 2 | 3;
  imageUrl: string | null;
  tagline: string | null;
  taglineSub: string | null;
  className: string;
  imageClassName: string;
  priority?: boolean;
}) {
  const resolved = useResolvedHeroSlot(slot, imageUrl, tagline, taglineSub);

  return (
    <div className={`absolute ${className}`}>
      <div className={`relative w-full ${imageClassName}`}>
        <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/80 bg-ink-100 shadow-card-hover">
          <Image
            src={resolved.src}
            alt=""
            fill
            priority={priority}
            unoptimized
            onError={resolved.onImageError}
            className="object-cover"
            sizes="420px"
          />
        </div>
        {resolved.tagline?.trim() ? (
          <HeroTagOverlay slot={slot} tagline={resolved.tagline} taglineSub={resolved.taglineSub} />
        ) : null}
      </div>
    </div>
  );
}

export default function HeroCollage({ hero }: { hero: PublicHeroSettings }) {
  const s1 = hero.slots.find((s) => s.slot === 1)!;
  const s2 = hero.slots.find((s) => s.slot === 2)!;
  const s3 = hero.slots.find((s) => s.slot === 3)!;

  return (
    <div className="relative mx-auto mt-12 w-full max-w-xl lg:mt-0 lg:max-w-none">
      <div
        className="pointer-events-none absolute -right-8 top-8 hidden h-56 w-56 rounded-full bg-azure-200/40 blur-3xl lg:block"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-6 bottom-4 hidden h-48 w-48 rounded-full bg-violet-200/30 blur-3xl lg:block"
        aria-hidden
      />

      {/* Mobile: no overlap — taglines sit below each image */}
      <div className="mx-auto w-full max-w-md space-y-3 px-1 lg:hidden">
        <MobileHeroCard
          slot={2}
          imageUrl={s2.imageUrl}
          tagline={s2.tagline}
          taglineSub={s2.taglineSub}
          aspectClass="aspect-[4/3]"
          priority
          imageClassName="shadow-lg"
        />
        <div className="grid grid-cols-2 items-stretch gap-3">
          <MobileHeroCard
            slot={1}
            imageUrl={s1.imageUrl}
            tagline={s1.tagline}
            taglineSub={s1.taglineSub}
            aspectClass="aspect-[4/5]"
            figureClassName="h-full"
          />
          <MobileHeroCard
            slot={3}
            imageUrl={s3.imageUrl}
            tagline={s3.tagline}
            taglineSub={s3.taglineSub}
            aspectClass="aspect-[4/5]"
            figureClassName="h-full"
          />
        </div>
      </div>

      {/* Desktop: overlapping collage */}
      <div className="relative mx-auto hidden min-h-[480px] w-full lg:block">
        <DesktopHeroImageCard
          slot={2}
          imageUrl={s2.imageUrl}
          tagline={s2.tagline}
          taglineSub={s2.taglineSub}
          priority
          className="left-[8%] top-[6%] z-0 w-[78%] shadow-lg"
          imageClassName="aspect-[4/5]"
        />
        <DesktopHeroImageCard
          slot={1}
          imageUrl={s1.imageUrl}
          tagline={s1.tagline}
          taglineSub={s1.taglineSub}
          className="left-0 top-0 z-10 w-[46%]"
          imageClassName="aspect-[3/4]"
        />
        <DesktopHeroImageCard
          slot={3}
          imageUrl={s3.imageUrl}
          tagline={s3.tagline}
          taglineSub={s3.taglineSub}
          className="bottom-0 right-0 z-20 w-[50%]"
          imageClassName="aspect-[4/3]"
        />
      </div>
    </div>
  );
}
