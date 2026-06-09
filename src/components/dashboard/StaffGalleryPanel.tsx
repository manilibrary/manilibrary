"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminPageLoading } from "@/components/dashboard/AdminPageLoadingProvider";
import { compressImageUnder } from "@/lib/compress-image";
import { GALLERY_MAX_IMAGES, GALLERY_UPLOAD_MAX_BYTES } from "@/lib/gallery/constants";

type GalleryImage = {
  id: string;
  url: string;
  sortOrder: number;
  createdAt: string;
};

export default function StaffGalleryPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [maxImages, setMaxImages] = useState(GALLERY_MAX_IMAGES);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/gallery", { credentials: "include" });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        images?: GalleryImage[];
        maxImages?: number;
      };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not load gallery.");
      setImages(j.images ?? []);
      setMaxImages(j.maxImages ?? GALLERY_MAX_IMAGES);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load gallery.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useAdminPageLoading(loading);

  const atLimit = images.length >= maxImages;

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;

    const slotsLeft = maxImages - images.length;
    if (slotsLeft <= 0) {
      setErr(`Gallery is full (${maxImages} images max).`);
      return;
    }

    const batch = list.slice(0, slotsLeft);
    setUploading(true);
    setErr(null);
    setMsg(null);

    let added = 0;
    try {
      for (const raw of batch) {
        const compressed = await compressImageUnder(raw, GALLERY_UPLOAD_MAX_BYTES);
        const fd = new FormData();
        fd.set("file", compressed);
        const res = await fetch("/api/admin/gallery/upload", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const j = (await res.json()) as {
          ok?: boolean;
          error?: string;
          image?: GalleryImage;
        };
        if (!res.ok || !j.ok || !j.image) {
          throw new Error(j.error ?? "Upload failed.");
        }
        setImages((prev) => [...prev, j.image!].sort((a, b) => a.sortOrder - b.sortOrder));
        added += 1;
      }
      setMsg(
        added === 1 ? "1 photo added." : `${added} photos added.`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
      await load();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this photo from the gallery?")) return;
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/gallery/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not delete.");
      setImages((prev) => prev.filter((img) => img.id !== id));
      setMsg("Photo removed.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete.");
    }
  };

  if (loading) {
    return <p className="text-sm text-ink-500">Loading gallery…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-ink-900">Gallery photos</p>
          <p className="mt-1 text-sm text-ink-600">
            {images.length} / {maxImages} — shown on the homepage{" "}
            <a href="/gallery" className="font-medium text-azure-600 hover:underline">
              Gallery
            </a>{" "}
            section. Images over 5 MB are compressed in your browser before upload.
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={uploading || atLimit}
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) void uploadFiles(files);
            }}
          />
          <button
            type="button"
            disabled={uploading || atLimit}
            onClick={() => inputRef.current?.click()}
            className="rounded-full bg-azure-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-azure-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Uploading…" : atLimit ? "Gallery full" : "Add photos"}
          </button>
        </div>
      </div>

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

      {images.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-12 text-center text-sm text-ink-600">
          No gallery photos yet. Add up to {maxImages} images.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <li
              key={img.id}
              className="group relative overflow-hidden rounded-xl border border-ink-100 bg-white shadow-sm"
            >
              <div className="relative aspect-[4/3] bg-ink-50">
                <Image
                  src={img.url}
                  alt=""
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => void remove(img.id)}
                className="absolute right-2 top-2 rounded-full bg-ink-900/75 px-2.5 py-1 text-xs font-semibold text-white sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:focus:opacity-100"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
