"use client";

import { useEffect } from "react";

type Props = {
  active: boolean;
  label?: string;
};

export default function UploadBlockingOverlay({ active, label = "Uploading…" }: Props) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  if (!active) return null;
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink-900/40 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-xl">
        <svg
          className="h-5 w-5 animate-spin text-azure-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
        </svg>
        <span className="text-sm font-medium text-ink-900">{label}</span>
      </div>
    </div>
  );
}
