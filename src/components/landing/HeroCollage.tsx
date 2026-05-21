import Image from "next/image";
import type { PublicHeroSettings } from "@/lib/hero/hero-settings";

function SlotIcon({ slot }: { slot: 1 | 2 | 3 }) {
  const cls = "h-4 w-4 text-azure-500";
  if (slot === 1) {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (slot === 2) {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" />
    </svg>
  );
}

/** Shared tag inset on every hero card (bottom-left of the photo). */
const HERO_TAG_INSET = "bottom-3 left-3";

function HeroImageCard({
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
  const showCaption = Boolean(tagline?.trim() || taglineSub?.trim());
  const hasSub = Boolean(taglineSub?.trim());

  return (
    <div className={`absolute overflow-hidden rounded-2xl border border-white/80 bg-ink-100 shadow-card-hover ${className}`}>
      <div className={`relative w-full ${imageClassName}`}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            priority={priority}
            unoptimized
            className="object-cover"
            sizes="(max-width: 1024px) 70vw, 420px"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-ink-100 via-azure-50 to-ink-200" />
        )}
        {showCaption ? (
          <div
            className={`absolute ${HERO_TAG_INSET} z-10 w-max max-w-[calc(100%-1.5rem)] rounded-xl border border-ink-100/90 bg-white/95 shadow-md backdrop-blur-sm`}
          >
            <div
              className={`flex gap-2 px-3 ${hasSub ? "items-start py-2.5" : "items-center py-2"}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-azure-50 ${hasSub ? "mt-0.5" : ""}`}
              >
                <SlotIcon slot={slot} />
              </span>
              <div className="min-w-0 pr-0.5">
                {tagline?.trim() ? (
                  <p className="text-sm font-semibold leading-tight text-ink-900">{tagline}</p>
                ) : null}
                {hasSub ? (
                  <p className="mt-0.5 text-xs leading-snug text-ink-500">{taglineSub}</p>
                ) : null}
              </div>
            </div>
          </div>
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
        className="pointer-events-none absolute -right-8 top-8 h-56 w-56 rounded-full bg-azure-200/40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-6 bottom-4 h-48 w-48 rounded-full bg-violet-200/30 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto aspect-[4/5] w-full max-w-md sm:aspect-[5/6] lg:aspect-[4/5] lg:max-w-none lg:min-h-[480px]">
        <HeroImageCard
          slot={2}
          imageUrl={s2.imageUrl}
          tagline={s2.tagline}
          taglineSub={s2.taglineSub}
          priority
          className="left-[8%] top-[6%] z-0 w-[78%] shadow-lg"
          imageClassName="aspect-[4/5]"
        />
        <HeroImageCard
          slot={1}
          imageUrl={s1.imageUrl}
          tagline={s1.tagline}
          taglineSub={s1.taglineSub}
          className="left-0 top-0 z-20 w-[46%]"
          imageClassName="aspect-[3/4]"
        />
        <HeroImageCard
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
