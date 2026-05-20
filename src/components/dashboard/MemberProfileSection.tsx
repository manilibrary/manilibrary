"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { compressImageUnder } from "@/lib/compress-image";
import { displayPersonName } from "@/lib/format-person-name";

type Props = {
  fullName: string;
  deviceUserId: number;
  phone: string | null;
  email: string | null;
  verificationStatus: string;
  avatarUrl: string | null;
  onAvatarChanged: () => void;
};

function displayPhone(phone: string | null): string | null {
  const p = phone?.trim();
  if (!p || p.includes("@")) return null;
  return p;
}

function displayEmail(email: string | null, phone: string | null): string | null {
  const e = email?.trim();
  if (e) return e;
  const p = phone?.trim();
  if (p?.includes("@")) return p;
  return null;
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  const one = parts[0] ?? "?";
  return one.slice(0, 2).toUpperCase();
}

export default function MemberProfileSection({
  fullName,
  deviceUserId,
  phone,
  email,
  verificationStatus,
  avatarUrl,
  onAvatarChanged,
}: Props) {
  const phoneLabel = displayPhone(phone);
  const emailLabel = displayEmail(email, phone);
  const displayName = displayPersonName(fullName, "Member");
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(avatarUrl);

  useEffect(() => {
    setLocalAvatarUrl(avatarUrl);
  }, [avatarUrl]);

  const shownAvatarUrl = localAvatarUrl;

  const verificationLabel =
    verificationStatus === "approved"
      ? "Verified"
      : verificationStatus === "pending"
        ? "Pending review"
        : verificationStatus === "rejected"
          ? "Rejected"
          : verificationStatus === "resubmit"
            ? "Resubmit requested"
            : "Not submitted";

  const upload = useCallback(
    async (file: File) => {


      if (busyRef.current) return;
      busyRef.current = true;
      setErr(null);
      setMsg(null);
      setBusy(true);
      try {
        const compressed = await compressImageUnder(file);
        const fd = new FormData();
        fd.set("file", compressed);
        const res = await fetch("/api/me/avatar", { method: "POST", body: fd });
        const j = (await res.json()) as { error?: string; hint?: string; ok?: boolean; avatarUrl?: string };
        if (!res.ok || !j.ok) {
          const parts = [j.error, j.hint].filter(Boolean);
          throw new Error(parts.length ? parts.join(" ") : "Upload failed.");
        }
        if (j.avatarUrl) setLocalAvatarUrl(j.avatarUrl);
        window.dispatchEvent(
          new CustomEvent("manilibrary:avatar-changed", { detail: { avatarUrl: j.avatarUrl ?? null } }),
        );
        setMsg("Photo updated.");
        onAvatarChanged();
        await new Promise((r) => setTimeout(r, 5000));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [onAvatarChanged],
  );

  const removePhoto = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/me/avatar", { method: "DELETE" });
      const j = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !j.ok) {
        throw new Error(j.error ?? "Could not remove photo.");
      }
      setLocalAvatarUrl(null);
      window.dispatchEvent(
        new CustomEvent("manilibrary:avatar-changed", { detail: { avatarUrl: null } }),
      );
      setMsg("Photo removed.");
      onAvatarChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not remove photo.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [onAvatarChanged]);

  return (
    <div className="rounded-2xl border border-ink-100 bg-white py-5 pl-4 pr-5 shadow-sm sm:pl-5 sm:pr-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-4">
        <div
          className="relative flex shrink-0 flex-col items-center gap-3 sm:items-start"
          aria-busy={busy || undefined}
        >
          <div className="group relative h-28 w-28 overflow-hidden rounded-2xl border border-ink-100 bg-ink-50 shadow-inner">
            {busy ? (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-[2px]"
                role="status"
                aria-live="polite"
              >
                <svg
                  className="h-6 w-6 shrink-0 animate-spin text-azure-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden
                >
                  <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
                </svg>
                <span className="max-w-[6.5rem] text-center text-[10px] font-medium leading-snug text-ink-900">
                  Uploading…
                </span>
              </div>
            ) : null}
            {shownAvatarUrl ? (
              <Image
                src={shownAvatarUrl}
                alt=""
                width={112}
                height={112}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-ink-400">
                {initials(displayName)}
              </span>
            )}
            {shownAvatarUrl ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void removePhoto()}
                className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-ink-900/75 text-white opacity-0 shadow-sm ring-1 ring-white/40 transition-opacity group-hover:opacity-100 group-active:opacity-100 focus:opacity-100 hover:bg-ink-900 disabled:pointer-events-none disabled:opacity-40"
                aria-label="Remove profile photo"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-azure-500 px-4 py-2 text-xs font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
            >
              {busy ? "Working…" : shownAvatarUrl ? "Change photo" : "Upload photo"}
            </button>

          </div>
          <p className="max-w-[200px] text-center text-[11px] leading-snug text-ink-500 sm:text-left">
            JPG, PNG or WebP · up to 2&nbsp;MB. Shown on your member profile only.
          </p>
        </div>

        <dl className="min-w-0 flex-1 grid gap-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Name</dt>
            <dd className="mt-1 font-medium text-ink-900">{displayName}</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Device user id</dt>
            <dd className="mt-1 font-mono text-lg font-semibold text-azure-600">
              {String(deviceUserId).padStart(4, "0")}
            </dd>
          </div>
          {phoneLabel ? (
            <div className="min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Phone</dt>
              <dd className="mt-1 break-all text-ink-900">{phoneLabel}</dd>
            </div>
          ) : null}
          {emailLabel ? (
            <div className="flex min-w-0 flex-col gap-1 sm:col-span-2 sm:flex-row sm:items-center sm:gap-4">
              <dt className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-ink-500">Email</dt>
              <dd className="min-w-0 truncate text-ink-900" title={emailLabel}>
                {emailLabel}
              </dd>
            </div>
          ) : null}
          <div className="min-w-0 sm:col-span-2">
            <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-500">ID verification</dt>
            <dd className="mt-1 capitalize text-ink-900">{verificationLabel}</dd>
          </div>
        </dl>
      </div>

      {err ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="mt-4 text-sm text-emerald-800" role="status">
          {msg}
        </p>
      ) : null}

      <p className="mt-6 border-t border-ink-100 pt-4 text-xs text-ink-600">
        Desk staff and biometric devices use your four-digit member id (leading zeros are fine).
      </p>
    </div>
  );
}
