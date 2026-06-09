"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminPageLoading } from "@/components/dashboard/AdminPageLoadingProvider";
import { HERO_TAGLINE_MAX, HERO_TAGLINE_SUB_MAX } from "@/lib/hero/constants";
import type { HeroSlotPublic, PublicHeroSettings } from "@/lib/hero/hero-settings";
import {
  HERO_PLACEHOLDER_BY_KEY,
  HERO_PLACEHOLDERS,
  heroPlaceholderPickerId,
  isHeroPlaceholderUrl,
  parseHeroPlaceholderPickerId,
  type HeroPlaceholderKey,
} from "@/lib/hero/hero-placeholders";

type GalleryOption = {
  id: string;
  url: string;
};

const SLOT_LABELS: Record<number, { title: string; hint: string }> = {
  1: { title: "Hero 1 (top-left)", hint: "Smaller card, overlaps the main image." },
  2: { title: "Hero 2 (center — largest)", hint: "Main hero image; largest in the collage." },
  3: { title: "Hero 3 (bottom-right)", hint: "Smaller card on the lower right." },
};

function selectedPickerId(data: HeroSlotPublic): string | null {
  if (data.galleryImageId) return data.galleryImageId;
  const ph = isHeroPlaceholderUrl(data.imageUrl);
  return ph ? heroPlaceholderPickerId(ph) : null;
}

function SlotEditor({
  slot,
  data,
  gallery,
  usedGalleryElsewhere,
  usedPlaceholderElsewhere,
  busy,
  onSelectImage,
  onSaveText,
}: {
  slot: 1 | 2 | 3;
  data: HeroSlotPublic;
  gallery: GalleryOption[];
  usedGalleryElsewhere: Set<string>;
  usedPlaceholderElsewhere: Set<HeroPlaceholderKey>;
  busy: boolean;
  onSelectImage: (slot: 1 | 2 | 3, pickerId: string | null) => Promise<void>;
  onSaveText: (slot: 1 | 2 | 3, tagline: string, taglineSub: string) => Promise<void>;
}) {
  const [tagline, setTagline] = useState(data.tagline ?? "");
  const [taglineSub, setTaglineSub] = useState(data.taglineSub ?? "");
  const meta = SLOT_LABELS[slot];

  useEffect(() => {
    setTagline(data.tagline ?? "");
    setTaglineSub(data.taglineSub ?? "");
  }, [data.tagline, data.taglineSub]);

  const selectedId = selectedPickerId(data);
  const hasImage = Boolean(selectedId);

  const galleryOptions = useMemo(() => {
    return gallery.filter((g) => g.id === data.galleryImageId || !usedGalleryElsewhere.has(g.id));
  }, [gallery, data.galleryImageId, usedGalleryElsewhere]);

  const placeholderOptions = useMemo(() => {
    const currentPh = isHeroPlaceholderUrl(data.imageUrl);
    return HERO_PLACEHOLDERS.filter((p) => p.key === currentPh || !usedPlaceholderElsewhere.has(p.key));
  }, [data.imageUrl, usedPlaceholderElsewhere]);

  const activePlaceholderKey = isHeroPlaceholderUrl(data.imageUrl);
  const placeholderDef = activePlaceholderKey ? HERO_PLACEHOLDER_BY_KEY[activePlaceholderKey] : null;
  const taglinesLocked = Boolean(placeholderDef);
  const displayTagline = placeholderDef?.tagline ?? tagline;
  const displayTaglineSub = placeholderDef?.taglineSub ?? taglineSub;
  const previewUrl =
    data.imageUrl ??
    (data.galleryImageId ? (gallery.find((g) => g.id === data.galleryImageId)?.url ?? null) : null);

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-ink-900">{meta.title}</h3>
        <p className="mt-1 text-xs text-ink-500">{meta.hint}</p>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Image</span>
          {hasImage ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSelectImage(slot, null)}
              className="text-[10px] font-semibold uppercase tracking-widest text-red-500 hover:text-red-600 disabled:opacity-50"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto rounded-xl border border-ink-100 bg-ink-50/60 p-2">
          {placeholderOptions.map((p) => {
            const id = heroPlaceholderPickerId(p.key);
            const isSelected = selectedId === id;
            return (
              <button
                key={id}
                type="button"
                disabled={busy}
                title={p.label}
                onClick={() => void onSelectImage(slot, isSelected ? null : id)}
                aria-pressed={isSelected}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 transition disabled:opacity-50 ${
                  isSelected ? "border-azure-500 ring-2 ring-azure-500/30" : "border-transparent hover:border-ink-200"
                }`}
              >
                <Image src={p.src} alt="" fill unoptimized className="object-cover" sizes="120px" />
                <span className="absolute inset-x-0 bottom-0 bg-ink-900/70 px-1 py-0.5 text-center text-[8px] font-medium text-white">
                  Placeholder
                </span>
                {isSelected ? (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-azure-500 text-white shadow">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : null}
              </button>
            );
          })}
          {galleryOptions.map((g) => {
            const isSelected = selectedId === g.id;
            return (
              <button
                key={g.id}
                type="button"
                disabled={busy}
                onClick={() => void onSelectImage(slot, isSelected ? null : g.id)}
                aria-pressed={isSelected}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 transition disabled:opacity-50 ${
                  isSelected ? "border-azure-500 ring-2 ring-azure-500/30" : "border-transparent hover:border-ink-200"
                }`}
              >
                <Image src={g.url} alt="" fill unoptimized className="object-cover" sizes="120px" />
                {isSelected ? (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-azure-500 text-white shadow">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
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
        {previewUrl ? (
          <Image src={previewUrl} alt="" fill unoptimized className="object-cover" sizes="320px" />
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
            value={displayTagline}
            maxLength={HERO_TAGLINE_MAX}
            disabled={busy || taglinesLocked}
            readOnly={taglinesLocked}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="e.g. Silent Cabins"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-900 outline-none focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15 disabled:opacity-50 read-only:bg-ink-50 read-only:text-ink-600"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-500">
            Subtitle
          </label>
          <input
            type="text"
            value={displayTaglineSub}
            maxLength={HERO_TAGLINE_SUB_MAX}
            disabled={busy || taglinesLocked}
            readOnly={taglinesLocked}
            onChange={(e) => setTaglineSub(e.target.value)}
            placeholder="e.g. Distraction-free zones"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-900 outline-none focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15 disabled:opacity-50 read-only:bg-ink-50 read-only:text-ink-600"
          />
        </div>
      </div>
      {taglinesLocked ? (
        <p className="mt-2 text-xs text-ink-500">Taglines are fixed for placeholder images.</p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSaveText(slot, tagline, taglineSub)}
          className="mt-3 rounded-full bg-azure-500 px-4 py-2 text-xs font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
        >
          Save taglines
        </button>
      )}
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
        fetch("/api/admin/gallery", { credentials: "include" }),
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

  useAdminPageLoading(loading);

  const usedGalleryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of hero?.slots ?? []) {
      if (s.galleryImageId) ids.add(s.galleryImageId);
    }
    return ids;
  }, [hero]);

  const usedPlaceholderKeys = useMemo(() => {
    const keys = new Set<HeroPlaceholderKey>();
    for (const s of hero?.slots ?? []) {
      const k = isHeroPlaceholderUrl(s.imageUrl);
      if (k) keys.add(k);
    }
    return keys;
  }, [hero]);

  const patchSlot = async (
    slot: 1 | 2 | 3,
    patch: {
      galleryImageId?: string | null;
      placeholderKey?: HeroPlaceholderKey | null;
      tagline?: string;
      taglineSub?: string;
    },
  ): Promise<boolean> => {
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
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
      await load();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const selectImage = async (slot: 1 | 2 | 3, pickerId: string | null) => {
    if (pickerId === null) {
      const ok = await patchSlot(slot, { galleryImageId: null, placeholderKey: null });
      if (ok) setMsg(`Hero ${slot} image cleared.`);
      return;
    }
    const ph = parseHeroPlaceholderPickerId(pickerId);
    const ok = ph
      ? await patchSlot(slot, { placeholderKey: ph, galleryImageId: null })
      : await patchSlot(slot, { galleryImageId: pickerId });
    if (ok) setMsg(`Hero ${slot} image updated.`);
  };

  const saveText = async (slot: 1 | 2 | 3, tagline: string, taglineSub: string) => {
    const ok = await patchSlot(slot, { tagline, taglineSub });
    if (ok) setMsg(`Hero ${slot} taglines saved.`);
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
        Pick a built-in placeholder or a photo from your{" "}
        <Link href="/dashboard/gallery" className="font-medium text-azure-600 hover:underline">
          Gallery
        </Link>
        . Each hero slot must use a different image.
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
          const usedGalleryElsewhere = new Set(usedGalleryIds);
          if (s.galleryImageId) usedGalleryElsewhere.delete(s.galleryImageId);
          const usedPlaceholderElsewhere = new Set(usedPlaceholderKeys);
          const currentPh = isHeroPlaceholderUrl(s.imageUrl);
          if (currentPh) usedPlaceholderElsewhere.delete(currentPh);
          return (
            <SlotEditor
              key={s.slot}
              slot={s.slot}
              data={s}
              gallery={gallery}
              usedGalleryElsewhere={usedGalleryElsewhere}
              usedPlaceholderElsewhere={usedPlaceholderElsewhere}
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
