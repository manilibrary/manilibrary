"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type GalleryImage = {
  id: string;
  url: string;
};

type Props = {
  /** When set, only this many photos are shown (homepage preview). */
  maxCount?: number;
  /** Show link to full gallery page when there are more photos than `maxCount`. */
  showViewMore?: boolean;
};

function GalleryGrid({ images, preview }: { images: GalleryImage[]; preview?: boolean }) {
  const gridClass = preview
    ? "grid w-full grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
    : "grid w-full grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4";

  return (
    <ul className={gridClass}>
      {images.map((img) => (
        <li
          key={img.id}
          className="min-w-0 overflow-hidden rounded-2xl border border-ink-100 bg-ink-50 shadow-sm"
        >
          <div className="relative aspect-[4/3]">
            <Image
              src={img.url}
              alt=""
              fill
              unoptimized
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition duration-300 hover:scale-[1.02]"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function PublicGalleryContent({ maxCount, showViewMore = false }: Props) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/public/gallery");
        const j = (await res.json()) as { ok?: boolean; images?: GalleryImage[] };
        if (!cancelled && res.ok && j.ok) {
          setImages(j.images ?? []);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => (maxCount != null ? images.slice(0, maxCount) : images),
    [images, maxCount],
  );

  const hasMore = maxCount != null && images.length > maxCount;

  if (!loaded) {
    return <p className="text-center text-sm text-ink-500">Loading gallery…</p>;
  }

  if (images.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-ink-200 bg-surface-muted px-6 py-10 text-center text-sm text-ink-600">
        Gallery photos coming soon.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <GalleryGrid images={visible} preview={maxCount != null} />
      {showViewMore && hasMore ? (
        <div className="flex justify-center">
          <Link
            href="/gallery"
            className="inline-flex items-center justify-center rounded-full border border-ink-200 bg-white px-6 py-2.5 text-sm font-semibold text-ink-800 shadow-sm transition hover:border-azure-300 hover:bg-azure-50 hover:text-azure-600"
          >
            View more
          </Link>
        </div>
      ) : null}
    </div>
  );
}
