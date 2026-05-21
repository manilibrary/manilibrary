"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { avatarDisplayUrl } from "@/lib/avatars/avatar-display-url";

type Testimonial = {
  fullName: string;
  subtitle: string;
  avatarUrl: string | null;
  rating: number;
  comment: string;
};

const DESKTOP_PAGE_SIZE = 3;
const MOBILE_BREAKPOINT = 768;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

function StarRating({ rating }: { rating: number }) {
  return (
    <p className="text-sm leading-none text-amber-400" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}
      <span className="text-ink-200">{"★".repeat(5 - rating)}</span>
    </p>
  );
}

function TestimonialCard({ item }: { item: Testimonial }) {
  const avatarSrc = avatarDisplayUrl(item.avatarUrl);
  return (
    <article className="flex h-full flex-col rounded-2xl border border-ink-100 bg-white p-6 shadow-sm md:p-7">
      <span className="font-serif text-5xl leading-none text-azure-200" aria-hidden>
        &ldquo;
      </span>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-700 md:text-[15px]">{item.comment}</p>
      <div className="mt-4">
        <StarRating rating={item.rating} />
      </div>
      <div className="mt-5 flex items-center gap-3 border-t border-ink-100 pt-5">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-ink-50 ring-1 ring-ink-100">
          {avatarSrc ? (
            <Image
              src={avatarSrc}
              alt=""
              width={44}
              height={44}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-ink-500">
              {initials(item.fullName)}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">{item.fullName}</p>
          <p className="truncate text-xs text-ink-500">{item.subtitle}</p>
        </div>
      </div>
    </article>
  );
}

function NavArrow({
  direction,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  disabled: boolean;
}) {
  const label = direction === "prev" ? "Previous testimonials" : "Next testimonials";
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-700 shadow-sm transition hover:border-azure-300 hover:bg-azure-50 hover:text-azure-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:bg-white disabled:hover:text-ink-700"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        {direction === "prev" ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        )}
      </svg>
    </button>
  );
}

function TestimonialCarousel({
  pages,
  pageIndex,
  pageCount,
}: {
  pages: Testimonial[][];
  pageIndex: number;
  pageCount: number;
}) {
  const slidePct = pageCount > 0 ? 100 / pageCount : 100;

  return (
    <div className="min-h-[16rem] min-w-0 flex-1 overflow-hidden" aria-live="polite">
      <div
        className="testimonials-carousel-track flex"
        style={{
          width: `${pageCount * 100}%`,
          transform: `translateX(-${pageIndex * slidePct}%)`,
        }}
      >
        {pages.map((page, pi) => (
          <div
            key={pi}
            className="shrink-0 px-0.5"
            style={{ width: `${slidePct}%` }}
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {page.map((item) => (
                <TestimonialCard
                  key={`${pi}-${item.fullName}-${item.comment}`}
                  item={item}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TestimonialsSection() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(1);

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

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px)`);
    const sync = () => setPageSize(mq.matches ? DESKTOP_PAGE_SIZE : 1);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const pages = useMemo(() => {
    const out: Testimonial[][] = [];
    for (let i = 0; i < items.length; i += pageSize) {
      out.push(items.slice(i, i + pageSize));
    }
    return out;
  }, [items, pageSize]);

  const pageCount = pages.length;

  useEffect(() => {
    if (pageCount === 0) {
      setPageIndex(0);
      return;
    }
    setPageIndex((i) => Math.min(i, pageCount - 1));
  }, [pageCount, pageSize]);

  const goPrev = useCallback(() => {
    setPageIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setPageIndex((i) => Math.min(pageCount - 1, i + 1));
  }, [pageCount]);

  const atStart = pageIndex <= 0;
  const atEnd = pageIndex >= pageCount - 1;

  return (
    <section id="testimonials" className="bg-surface-muted">
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
          <div className="mt-12">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="hidden md:block">
                <NavArrow direction="prev" onClick={goPrev} disabled={atStart || pageCount <= 1} />
              </div>
              <TestimonialCarousel pages={pages} pageIndex={pageIndex} pageCount={pageCount} />
              <div className="hidden md:block">
                <NavArrow direction="next" onClick={goNext} disabled={atEnd || pageCount <= 1} />
              </div>
            </div>

            {pageCount > 1 ? (
              <div
                className="mt-8 flex justify-center gap-2 md:hidden"
                role="tablist"
                aria-label="Testimonial pages"
              >
                {Array.from({ length: pageCount }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === pageIndex}
                    aria-label={`Page ${i + 1} of ${pageCount}`}
                    onClick={() => setPageIndex(i)}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      i === pageIndex ? "w-7 bg-azure-500" : "w-2.5 bg-ink-200 hover:bg-ink-300"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
