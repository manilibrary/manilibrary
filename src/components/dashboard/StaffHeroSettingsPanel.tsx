"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HERO_TAGLINE_MAX, HERO_TAGLINE_SUB_MAX } from "@/lib/hero/constants";
import type { HeroSlotPublic, PublicHeroSettings } from "@/lib/hero/hero-settings";

type GalleryOption = {
  id: string;
  url: string;
};

const SLOT_LABELS: Record<number, { title: string; hint: string }> = {
  1: { title: "Hero 1 (top-left)", hint: "Smaller card, overlaps the main image." },
  2: { title: "Hero 2 (center — largest)", hint: "Main hero image; largest in the collage." },
  3: { title: "Hero 3 (bottom-right)", hint: "Smaller card on the lower right." },
};

function SlotEditor({
  slot,
  data,
  gallery,
  usedElsewhere,
  busy,
  onSelectImage,
  onSaveText,
}: {
  slot: 1 | 2 | 3;
  data: HeroSlotPublic;
  gallery: GalleryOption[];
  usedElsewhere: Set<string>;
  busy: boolean;
  onSelectImage: (slot: 1 | 2 | 3, galleryImageId: string | null) => Promise<void>;
  onSaveText: (slot: 1 | 2 | 3, tagline: string, taglineSub: string) => Promise<void>;
}) {
  const [tagline, setTagline] = useState(data.tagline ?? "");
  const [taglineSub, setTaglineSub] = useState(data.taglineSub ?? "");
  const meta = SLOT_LABELS[slot];

  useEffect(() => {
    setTagline(data.tagline ?? "");
    setTaglineSub(data.taglineSub ?? "");
  }, [data.tagline, data.taglineSub]);

  const selectOptions = useMemo(() => {
    return gallery.filter(
      (g) => g.id === data.galleryImageId || !usedElsewhere.has(g.id),
    );
  }, [gallery, data.galleryImageId, usedElsewhere]);

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-ink-900">{meta.title}</h3>
        <p className="mt-1 text-xs text-ink-500">{meta.hint}</p>
      </div>

      <div className="mt-4">
        <label
          htmlFor={`hero-gallery-${slot}`}
          className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-500"
        >
          Gallery image
        </label>
        <select
          id={`hero-gallery-${slot}`}
          disabled={busy || gallery.length === 0}
          value={data.galleryImageId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            void onSelectImage(slot, v ? v : null);
          }}
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">— Select from gallery —</option>
          {selectOptions.map((g, i) => (
            <option key={g.id} value={g.id}>
              Gallery photo {i + 1}
            </option>
          ))}
        </select>
        {gallery.length === 0 ? (
          <p className="mt-2 text-xs text-ink-500">
            No gallery photos yet.{" "}
            <Link href="/dashboard/gallery" className="font-medium text-azure-600 hover:underline">
              Add photos in Gallery
            </Link>
            .
          </p>
        ) : null}
      </div>

      <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-xl border border-ink-100 bg-ink-50">
        {data.imageUrl ? (
          <Image src={data.imageUrl} alt="" fill unoptimized className="object-cover" sizes="320px" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-400">No image selected</div>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-500">
            Tagline
          </label>
          <input
            type="text"
            value={tagline}
            maxLength={HERO_TAGLINE_MAX}
            disabled={busy}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="e.g. Silent Cabins"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-900 outline-none focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-500">
            Subtitle
          </label>
          <input
            type="text"
            value={taglineSub}
            maxLength={HERO_TAGLINE_SUB_MAX}
            disabled={busy}
            onChange={(e) => setTaglineSub(e.target.value)}
            placeholder="e.g. Distraction-free zones"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-900 outline-none focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15 disabled:opacity-50"
          />
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onSaveText(slot, tagline, taglineSub)}
        className="mt-3 rounded-full bg-azure-500 px-4 py-2 text-xs font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
      >
        Save taglines
      </button>
    </div>
  );
}

export default function StaffHeroSettingsPanel() {
  const [hero, setHero] = useState<PublicHeroSettings | null>(null);
  const [gallery, setGallery] = useState<GalleryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [heroRes, galRes] = await Promise.all([
        fetch("/api/admin/hero", { credentials: "include" }),
        fetch("/api/admin/gallery/list", { credentials: "include" }),
      ]);
      const heroJ = (await heroRes.json()) as { ok?: boolean; error?: string; hero?: PublicHeroSettings };
      const galJ = (await galRes.json()) as {
        ok?: boolean;
        error?: string;
        images?: { id: string; url: string }[];
      };
      if (!heroRes.ok || !heroJ.ok) throw new Error(heroJ.error ?? "Could not load hero settings.");
      if (!galRes.ok || !galJ.ok) throw new Error(galJ.error ?? "Could not load gallery.");
      setHero(heroJ.hero ?? null);
      setGallery((galJ.images ?? []).map((i) => ({ id: i.id, url: i.url })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load hero settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const usedGalleryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of hero?.slots ?? []) {
      if (s.galleryImageId) ids.add(s.galleryImageId);
    }
    return ids;
  }, [hero]);

  const patchSlot = async (
    slot: 1 | 2 | 3,
    patch: { galleryImageId?: string | null; tagline?: string; taglineSub?: string },
  ) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/hero", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, ...patch }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; hero?: PublicHeroSettings };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not save.");
      setHero(j.hero ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const selectImage = async (slot: 1 | 2 | 3, galleryImageId: string | null) => {
    await patchSlot(slot, { galleryImageId });
    setMsg(galleryImageId ? `Hero ${slot} image updated.` : `Hero ${slot} image cleared.`);
  };

  const saveText = async (slot: 1 | 2 | 3, tagline: string, taglineSub: string) => {
    await patchSlot(slot, { tagline, taglineSub });
    setMsg(`Hero ${slot} taglines saved.`);
  };

  if (loading) {
    return <p className="text-sm text-ink-500">Loading homepage hero…</p>;
  }

  if (!hero) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
        {err ?? "Could not load hero settings."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">
        Pick images from your{" "}
        <Link href="/dashboard/gallery" className="font-medium text-azure-600 hover:underline">
          Gallery
        </Link>
        . Each hero slot must use a different photo.
      </p>
      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          {msg}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        {hero.slots.map((s) => {
          const usedElsewhere = new Set(usedGalleryIds);
          if (s.galleryImageId) usedElsewhere.delete(s.galleryImageId);
          return (
            <SlotEditor
              key={s.slot}
              slot={s.slot}
              data={s}
              gallery={gallery}
              usedElsewhere={usedElsewhere}
              busy={busy}
              onSelectImage={selectImage}
              onSaveText={saveText}
            />
          );
        })}
      </div>
    </div>
  );
}
