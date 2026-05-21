"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { avatarDisplayUrl } from "@/lib/avatars/avatar-display-url";

type Testimonial = {
  fullName: string;
  avatarUrl: string | null;
  rating: number;
  comment: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

function TestimonialCard({ item }: { item: Testimonial }) {
  const avatarSrc = avatarDisplayUrl(item.avatarUrl);
  return (
    <article className="relative flex h-full w-[min(88vw,22rem)] shrink-0 flex-col justify-between rounded-2xl border border-ink-200/80 bg-ink-900 px-6 py-7 text-white shadow-card-hover sm:w-[22rem]">
      <span
        className="pointer-events-none select-none font-serif text-6xl leading-none text-white/10"
        aria-hidden
      >
        &ldquo;
      </span>
      <p className="mt-2 text-base font-semibold leading-snug text-white sm:text-lg">{item.comment}</p>
      <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-azure-400/40">
          {avatarSrc ? (
            <Image
              src={avatarSrc}
              alt=""
              width={40}
              height={40}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/80">
              {initials(item.fullName)}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{item.fullName}</p>
          <p className="text-xs text-amber-300" aria-label={`${item.rating} out of 5 stars`}>
            {"★".repeat(item.rating)}
            <span className="text-white/20">{"★".repeat(5 - item.rating)}</span>
          </p>
        </div>
      </div>
    </article>
  );
}

export default function TestimonialsSection() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/public/testimonials");
        const j = (await res.json()) as { ok?: boolean; testimonials?: Testimonial[] };
        if (!cancelled && res.ok && j.ok) {
          setItems(j.testimonials ?? []);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const marquee = items.length >= 3;
  const loop = useMemo(() => {
    if (items.length === 0) return [];
    return marquee ? [...items, ...items] : items;
  }, [items, marquee]);

  return (
    <section id="testimonials" className="overflow-hidden bg-surface-muted">
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-azure-500">Testimonials</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl">
            What our members say
          </h2>
          <p className="mt-4 text-base text-ink-600">
            Real feedback from students who study at Mani Library.
          </p>
        </div>

        {!loaded ? (
          <p className="mt-12 text-center text-sm text-ink-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-12 rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center text-sm text-ink-600">
            No feedbacks yet.
          </p>
        ) : (
          <div
            className={`mt-12 ${marquee ? "testimonials-marquee-mask overflow-hidden" : "flex flex-wrap justify-center gap-4"}`}
          >
            <div
              className={`flex gap-4 py-2 ${marquee ? "testimonials-marquee w-max" : "flex-wrap justify-center"}`}
            >
              {loop.map((item, i) => (
                <TestimonialCard key={`${item.comment}-${item.fullName}-${i}`} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
