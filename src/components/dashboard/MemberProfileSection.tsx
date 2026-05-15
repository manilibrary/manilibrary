"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { displayPersonName } from "@/lib/format-person-name";

type Props = {
  fullName: string;
  deviceUserId: number;
  phone: string | null;
  verificationStatus: string;
  avatarUrl: string | null;
  onAvatarChanged: () => void;
};

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
  verificationStatus,
  avatarUrl,
  onAvatarChanged,
}: Props) {
  const displayName = displayPersonName(fullName, "Member");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
      setErr(null);
      setMsg(null);
      setBusy(true);
      try {
        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch("/api/me/avatar", { method: "POST", body: fd });
        const j = (await res.json()) as { error?: string; hint?: string; ok?: boolean };
        if (!res.ok || !j.ok) {
          const parts = [j.error, j.hint].filter(Boolean);
          throw new Error(parts.length ? parts.join(" ") : "Upload failed.");
        }
        setMsg("Photo updated.");
        onAvatarChanged();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBusy(false);
      }
    },
    [onAvatarChanged],
  );

  const removePhoto = useCallback(async () => {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/me/avatar", { method: "DELETE" });
      const j = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !j.ok) {
        throw new Error(j.error ?? "Could not remove photo.");
      }
      setMsg("Photo removed.");
      onAvatarChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not remove photo.");
    } finally {
      setBusy(false);
    }
  }, [onAvatarChanged]);

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center gap-3 sm:items-start">
          <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-ink-100 bg-ink-50 shadow-inner">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
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
              {busy ? "Working…" : avatarUrl ? "Change photo" : "Upload photo"}
            </button>
            {avatarUrl ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void removePhoto()}
                className="rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
              >
                Remove
              </button>
            ) : null}
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
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Library number</dt>
            <dd className="mt-1 font-mono text-lg font-semibold text-azure-600">
              {String(deviceUserId).padStart(4, "0")}
            </dd>
          </div>
          {phone ? (
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Phone</dt>
              <dd className="mt-1 text-ink-900">{phone}</dd>
            </div>
          ) : (
            <div className="hidden sm:block" aria-hidden />
          )}
          <div className="sm:col-span-2">
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
