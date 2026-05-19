"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { compressImageUnder } from "@/lib/compress-image";
import { createClient } from "@/lib/supabase/client";
import {
  readMembershipIntakeDraft,
  writeMembershipIntakeDraft,
} from "@/lib/membership/membership-intake-draft";

export type ProfileIntakeInitial = {
  aadhaar_last_four: string | null;
  student_roll_number: string | null;
  institution_type: string | null;
  preparing_for: string | null;
  verification_status: string;
};

type Props = {
  initial: ProfileIntakeInitial;
  /** Doc types that already have a submitted file on the open `verification` row (`verification_documents`). */
  uploadedDocs?: Record<string, boolean>;
  /** During checkout: doc types staged in `verification_documents` with phase `checkout_pending`. */
  checkoutStagedDocs?: Record<string, boolean>;
  onSaved?: () => void;
  /** After a checkout-staged upload succeeds; parent refetches staged list. */
  onStagedDocChange?: () => void;
  /** Checkout only: false when checkout staging API reports the schema is not ready. */
  checkoutKycStagingReady?: boolean;
  /** Membership checkout: keep profile PATCH off the server until payment succeeds (sessionStorage draft). */
  persistMode?: "immediate" | "defer_to_payment";
};

const INSTITUTIONS = [
  { value: "", label: "Select…" },
  { value: "school", label: "School" },
  { value: "college", label: "College" },
  { value: "freelance", label: "Freelance / self-study" },
  { value: "other", label: "Other" },
];

function institutionLabel(value: string): string {
  const v = value.trim();
  if (!v) return "—";
  return INSTITUTIONS.find((o) => o.value === v)?.label ?? v;
}

function statusBadge(s: string) {
  const norm = s?.toLowerCase() ?? "none";
  if (norm === "approved") return { cls: "bg-emerald-100 text-emerald-800", label: "Verified" };
  if (norm === "pending") return { cls: "bg-amber-100 text-amber-900", label: "Pending review" };
  if (norm === "rejected") return { cls: "bg-red-100 text-red-800", label: "Rejected" };
  if (norm === "resubmit") return { cls: "bg-violet-100 text-violet-900", label: "Resubmit requested" };
  return { cls: "bg-ink-100 text-ink-700", label: "Not submitted" };
}

const KYC_DOC_KEYS = ["aadhaar_front", "aadhaar_back", "student_id"] as const;

function checkoutStoredNameKey(userId: string, docType: string) {
  return `ml_kyc_nm_co:${userId}:${docType}`;
}

function dashStoredNameKey(userId: string, docType: string) {
  return `ml_kyc_nm_dash:${userId}:${docType}`;
}

export default function ProfileIntakeCard({
  initial,
  uploadedDocs = {},
  checkoutStagedDocs = {},
  onSaved,
  onStagedDocChange,
  checkoutKycStagingReady = true,
  persistMode = "immediate",
}: Props) {
  const [last4, setLast4] = useState(initial.aadhaar_last_four ?? "");
  const [roll, setRoll] = useState(initial.student_roll_number ?? "");
  const [institution, setInstitution] = useState(initial.institution_type ?? "");
  const [preparing, setPreparing] = useState(initial.preparing_for ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [upBusy, setUpBusy] = useState<string | null>(null);
  const [upErr, setUpErr] = useState<string | null>(null);
  const [docDisplayNames, setDocDisplayNames] = useState<Record<string, string>>({});
  const [nameHydrateTick, setNameHydrateTick] = useState(0);
  /** Checkout: after draft vs server values are applied to fields, autosave may run. */
  const [deferDraftReady, setDeferDraftReady] = useState(false);
  /** Dashboard verified: compact read-only until user opens the overflow menu. */
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [editingFields, setEditingFields] = useState(true);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const isDefer = persistMode === "defer_to_payment";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (isDefer) {
        setDeferDraftReady(false);
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const d = readMembershipIntakeDraft(user.id);
          if (d) {
            setLast4(d.aadhaar_last_four ?? "");
            setRoll(d.student_roll_number ?? "");
            setInstitution(d.institution_type ?? "");
            setPreparing(d.preparing_for ?? "");
            if (!cancelled) setDeferDraftReady(true);
            return;
          }
        }
      } else {
        setDeferDraftReady(false);
      }
      queueMicrotask(() => {
        if (cancelled) return;
        setLast4(initial.aadhaar_last_four ?? "");
        setRoll(initial.student_roll_number ?? "");
        setInstitution(initial.institution_type ?? "");
        setPreparing(initial.preparing_for ?? "");
        if (!cancelled && isDefer) setDeferDraftReady(true);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [initial, isDefer]);

  useEffect(() => {
    void (async () => {
      if (typeof window === "undefined") return;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const next: Record<string, string> = {};
      for (const key of KYC_DOC_KEYS) {
        if (isDefer && checkoutStagedDocs[key]) {
          const v = sessionStorage.getItem(checkoutStoredNameKey(user.id, key));
          if (v) next[key] = v;
        }
        if (!isDefer && uploadedDocs[key]) {
          const v = sessionStorage.getItem(dashStoredNameKey(user.id, key));
          if (v) next[key] = v;
        }
      }
      setDocDisplayNames(next);
    })();
  }, [isDefer, checkoutStagedDocs, uploadedDocs, nameHydrateTick]);

  const verificationNorm = (initial.verification_status || "none").toLowerCase();
  const verifiedOnDashboard = !isDefer && verificationNorm === "approved";
  const allKycSlotsFilled = KYC_DOC_KEYS.every((k) => uploadedDocs[k]);
  const allowUploads =
    verificationNorm === "none" ||
    verificationNorm === "resubmit" ||
    (verificationNorm === "pending" && !allKycSlotsFilled);
  const allowDeferDocUploads =
    isDefer &&
    verificationNorm !== "approved" &&
    (verificationNorm === "none" || verificationNorm === "resubmit");
  const deferStagingOk = !isDefer || checkoutKycStagingReady;
  const v = statusBadge(initial.verification_status);

  useEffect(() => {
    queueMicrotask(() => {
      if (isDefer) {
        setEditingFields(true);
        return;
      }
      if (verifiedOnDashboard) {
        setEditingFields(false);
      } else {
        setEditingFields(true);
      }
    });
  }, [isDefer, verifiedOnDashboard]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const el = profileMenuRef.current;
      if (el && !el.contains(e.target as Node)) setProfileMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!deferStagingOk) {
      queueMicrotask(() => setUpErr(null));
    }
  }, [deferStagingOk]);

  useEffect(() => {
    if (!isDefer || !deferDraftReady) return;
    const handle = window.setTimeout(() => {
      void (async () => {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const digits = last4.replace(/\D/g, "").slice(0, 4);
        writeMembershipIntakeDraft({
          userId: user.id,
          aadhaar_last_four: digits.length === 4 ? digits : null,
          student_roll_number: roll.trim() || null,
          institution_type: institution || null,
          preparing_for: preparing.trim() || null,
        });
      })();
    }, 400);
    return () => window.clearTimeout(handle);
  }, [last4, roll, institution, preparing, isDefer, deferDraftReady]);

  const saveIntake = useCallback(async () => {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const digits = last4.replace(/\D/g, "").slice(0, 4);
      const res = await fetch("/api/me/profile-intake", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aadhaar_last_four: digits.length === 4 ? digits : null,
          student_roll_number: roll.trim() || null,
          institution_type: institution || null,
          preparing_for: preparing.trim() || null,
        }),
      });
      const j = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not save.");
      setMsg("Saved.");
      if (verifiedOnDashboard) {
        setEditingFields(false);
        setProfileMenuOpen(false);
      }
      onSaved?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }, [last4, roll, institution, preparing, onSaved, verifiedOnDashboard]);

  const upload = useCallback(
    async (docType: "aadhaar_front" | "aadhaar_back" | "student_id", file: File | null) => {
      if (!file) return;
      setUpErr(null);
      setUpBusy(docType);
      try {
        const compressed = await compressImageUnder(file);
        const fd = new FormData();
        fd.set("file", compressed);
        fd.set("docType", docType);
        const res = await fetch("/api/me/verification/document", { method: "POST", body: fd });
        const j = (await res.json()) as { error?: string; hint?: string; ok?: boolean };
        if (!res.ok || !j.ok) {
          const parts = [j.error, j.hint].filter(Boolean);
          throw new Error(parts.length ? parts.join(" — ") : "Upload failed.");
        }
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && typeof window !== "undefined") {
          sessionStorage.setItem(dashStoredNameKey(user.id, docType), file.name);
          setNameHydrateTick((t) => t + 1);
        }
        setMsg("Document saved. Upload any remaining files below, then wait for staff review.");
        onSaved?.();
      } catch (e) {
        setUpErr(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setUpBusy(null);
      }
    },
    [onSaved],
  );

  const uploadCheckoutPending = useCallback(
    async (docType: "aadhaar_front" | "aadhaar_back" | "student_id", file: File | null) => {
      if (!file) return;
      setUpErr(null);
      setUpBusy(docType);
      try {
        const compressed = await compressImageUnder(file);
        const fd = new FormData();
        fd.set("file", compressed);
        fd.set("docType", docType);
        const res = await fetch("/api/me/verification/document-checkout-pending", { method: "POST", body: fd });
        const j = (await res.json()) as { error?: string; hint?: string; ok?: boolean };
        if (!res.ok || !j.ok) {
          const parts = [j.error, j.hint].filter(Boolean);
          throw new Error(parts.length ? parts.join(" — ") : "Upload failed.");
        }
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && typeof window !== "undefined") {
          sessionStorage.setItem(checkoutStoredNameKey(user.id, docType), file.name);
          setNameHydrateTick((t) => t + 1);
        }
        setMsg("Uploaded. Change file anytime before you pay.");
        onStagedDocChange?.();
      } catch (e) {
        setUpErr(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setUpBusy(null);
      }
    },
    [onStagedDocChange],
  );

  const cancelFieldEdit = useCallback(() => {
    setLast4(initial.aadhaar_last_four ?? "");
    setRoll(initial.student_roll_number ?? "");
    setInstitution(initial.institution_type ?? "");
    setPreparing(initial.preparing_for ?? "");
    setErr(null);
    setMsg(null);
    setProfileMenuOpen(false);
    if (verifiedOnDashboard) setEditingFields(false);
  }, [initial, verifiedOnDashboard]);

  const showFieldForm = isDefer || editingFields || !verifiedOnDashboard;

  return (
    <div className="w-full space-y-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
      <div
        className={`relative flex flex-wrap items-start justify-between gap-3 ${verifiedOnDashboard ? "pr-10 sm:pr-12" : ""}`}
      >
        <div className="min-w-0 flex-1">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-azure-600">Profile &amp; KYC</h2>
          {verificationNorm === "approved" ? null : isDefer ? null : (
            <p className="mt-1 text-sm text-ink-600">
              {verificationNorm === "pending" && !allKycSlotsFilled ? (
                <>
                  Your submission is in progress. Please upload the <strong className="font-medium">remaining documents</strong>{" "}
                  below; you can finish in any order. Once all three slots are filled, staff can review your KYC.
                </>
              ) : verificationNorm === "pending" ? (
                <>
                  Your documents are <strong className="font-medium">submitted for review</strong>. Uploads stay closed
                  until staff ask for new files.
                </>
              ) : verificationNorm === "rejected" ? (
                <>
                  Verification was not accepted. Please contact the library. Staff can open uploads again from their
                  dashboard when they request a new submission.
                </>
              ) : verificationNorm === "resubmit" ? (
                <>
                  Staff have requested <strong className="font-medium">new documents</strong>. Please upload below, then
                  wait for review.
                </>
              ) : (
                <>
                  Only the <strong className="font-medium">last 4 digits</strong> of Aadhaar are stored. Upload documents
                  when convenient; an admin verifies from the members list.
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          {!isDefer ? <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${v.cls}`}>{v.label}</span> : null}
          {!isDefer && verifiedOnDashboard ? (
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                aria-label="Profile actions"
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                onClick={() => setProfileMenuOpen((o) => !o)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-ink-500 transition hover:border-ink-200 hover:bg-ink-50 hover:text-ink-800"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="12" cy="5" r="1.75" />
                  <circle cx="12" cy="12" r="1.75" />
                  <circle cx="12" cy="19" r="1.75" />
                </svg>
              </button>
              {profileMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-1 min-w-[11rem] rounded-xl border border-ink-100 bg-white py-1 shadow-lg ring-1 ring-black/5"
                >
                  {!editingFields ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full px-3 py-2 text-left text-sm text-ink-800 hover:bg-ink-50"
                      onClick={() => {
                        setEditingFields(true);
                        setProfileMenuOpen(false);
                      }}
                    >
                      Edit profile details
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full px-3 py-2 text-left text-sm text-ink-800 hover:bg-ink-50"
                      onClick={() => {
                        cancelFieldEdit();
                        setProfileMenuOpen(false);
                      }}
                    >
                      Cancel editing
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {!showFieldForm && verifiedOnDashboard ? (
        <dl className="grid gap-4 rounded-xl border border-ink-100 bg-ink-50/50 p-4 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Aadhaar (last 4)</dt>
            <dd className="mt-1.5 font-mono text-sm font-medium tracking-widest text-ink-900">
              {last4.replace(/\D/g, "").length === 4 ? `•••• ${last4.replace(/\D/g, "").slice(0, 4)}` : "—"}
            </dd>
          </div>
          <div className="sm:col-span-1">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Student / member ID</dt>
            <dd className="mt-1.5 text-sm text-ink-900">{roll.trim() ? roll.trim() : "—"}</dd>
          </div>
          <div className="sm:col-span-1">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Institution</dt>
            <dd className="mt-1.5 text-sm text-ink-900">{institutionLabel(institution)}</dd>
          </div>
          <div className="sm:col-span-1">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Preparing for</dt>
            <dd className="mt-1.5 text-sm leading-snug text-ink-900">{preparing.trim() ? preparing.trim() : "—"}</dd>
          </div>
        </dl>
      ) : (
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <label className="grid gap-1 sm:col-span-1">
            <span className="text-xs text-ink-600">Aadhaar — last 4 digits only</span>
            <input
              inputMode="numeric"
              maxLength={4}
              className="rounded-lg border border-ink-200 px-3 py-2 font-mono tracking-widest"
              placeholder="e.g. 1234"
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </label>
          <label className="grid gap-1 sm:col-span-1">
            <span className="text-xs text-ink-600">Student / member roll or ID number</span>
            <input
              className="rounded-lg border border-ink-200 px-3 py-2"
              value={roll}
              onChange={(e) => setRoll(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="grid gap-1 sm:col-span-1">
            <span className="text-xs text-ink-600">Institution</span>
            <select
              className="rounded-lg border border-ink-200 px-3 py-2"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            >
              {INSTITUTIONS.map((o) => (
                <option key={o.value || "x"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 sm:col-span-1">
            <span className="text-xs text-ink-600">Preparing for (exam / goal)</span>
            <input
              className="rounded-lg border border-ink-200 px-3 py-2"
              value={preparing}
              onChange={(e) => setPreparing(e.target.value)}
              placeholder="e.g. UPSC CSE, Bihar Board 12th, …"
            />
          </label>
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            {!isDefer ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveIntake()}
                  className="rounded-full bg-azure-500 px-4 py-2 text-sm font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save details"}
                </button>
                {verifiedOnDashboard && editingFields ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => cancelFieldEdit()}
                    className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className={`min-h-[1.25rem] ${isDefer ? "sm:ml-auto sm:text-right" : ""}`}>
              {msg ? (
                <p className="text-sm text-emerald-800" role="status">
                  {msg}
                </p>
              ) : null}
              {err ? (
                <p className="text-sm text-red-700" role="alert">
                  {err}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-ink-100 pt-4">
        {isDefer && verificationNorm !== "approved" ? (
          allowDeferDocUploads ? (
            deferStagingOk ? (
            <>
              <h3 className="text-sm font-semibold text-ink-900">Upload your ID (optional)</h3>
              {upErr ? (
                <p className="mt-2 text-xs text-red-700" role="alert">
                  {upErr}
                </p>
              ) : null}
              <ul className="mt-3 space-y-2 text-xs">
                {(
                  [
                    ["aadhaar_front", "Aadhaar front"],
                    ["aadhaar_back", "Aadhaar back"],
                    ["student_id", "Student ID"],
                  ] as const
                ).map(([key, label]) => {
                  const hasStaged = Boolean(checkoutStagedDocs[key]);
                  const hasServer = Boolean(uploadedDocs[key]);
                  const hasFile = hasStaged || hasServer;
                  const displayName = docDisplayNames[key];
                  const inputId = `ml-checkout-doc-${key}`;
                  const rightLabel = displayName || (hasFile ? "Tap to change" : "Upload");
                  return (
                    <li key={key} className="rounded-lg border border-ink-100 bg-ink-50/50 px-3 py-2.5">
                      <div className="flex min-h-10 items-center justify-between gap-3">
                        <span className="min-w-0 shrink-0 text-sm font-medium text-ink-800">{label}</span>
                        <div className="flex min-w-0 max-w-[70%] items-center justify-end gap-2">
                          {upBusy === key ? (
                            <span className="shrink-0 text-[11px] text-azure-600">Uploading…</span>
                          ) : null}
                          <input
                            id={inputId}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            disabled={upBusy !== null}
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              e.target.value = "";
                              void uploadCheckoutPending(key, f);
                            }}
                          />
                          <label
                            htmlFor={inputId}
                            title={displayName ? displayName : hasFile ? "Tap to choose a different file" : undefined}
                            className={`min-w-0 cursor-pointer truncate text-right text-sm font-semibold ${
                              hasFile
                                ? "text-azure-700 underline decoration-azure-300 underline-offset-2"
                                : "rounded-md border border-ink-200 bg-white px-3 py-1.5 text-ink-800 shadow-sm hover:bg-ink-50"
                            } ${upBusy !== null ? "pointer-events-none opacity-50" : ""}`}
                          >
                            {rightLabel}
                          </label>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-ink-900">Upload your ID (optional)</h3>
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
                  <p className="font-semibold">One-time database setup</p>
                  <p className="mt-1 leading-relaxed text-amber-900/95">
                    Open Supabase → SQL Editor → paste and run{" "}
                    <code className="rounded bg-white/90 px-1 py-0.5 font-mono text-[11px] text-ink-800">
                      supabase/kyc-checkout-pending-documents.sql
                    </code>{" "}
                    from this project, then reload this page.
                  </p>
                </div>
              </>
            )
          ) : (
            <>
              <h3 className="text-xs font-semibold text-ink-800">ID uploads</h3>
              <p className="mt-1 text-xs text-ink-600">
                Use <strong className="font-medium">Dashboard → Membership</strong> to change files — not here.
              </p>
            </>
          )
        ) : allowUploads ? (
          <>
            <h3 className="text-sm font-semibold text-ink-900">Upload ID (optional)</h3>
            {upErr ? (
              <p className="mt-2 text-xs text-red-700" role="alert">
                {upErr}
              </p>
            ) : null}
            <ul className="mt-3 space-y-2 text-xs">
              {(
                [
                  ["aadhaar_front", "Aadhaar front"],
                  ["aadhaar_back", "Aadhaar back"],
                  ["student_id", "Student ID"],
                ] as const
              ).map(([key, label]) => {
                const hasFile = Boolean(uploadedDocs[key]);
                const canReplace = verificationNorm === "none" || verificationNorm === "resubmit";
                const showPicker = !hasFile || canReplace;
                const displayName = docDisplayNames[key];
                const inputId = `ml-dash-doc-${key}`;
                const rightLabel = displayName || (hasFile ? "Tap to change" : "Upload");
                return (
                  <li key={key} className="rounded-lg border border-ink-100 bg-ink-50/50 px-3 py-2.5">
                    <div className="flex min-h-10 items-center justify-between gap-3">
                      <span className="min-w-0 shrink-0 text-sm font-medium text-ink-800">{label}</span>
                      {showPicker ? (
                        <div className="flex min-w-0 max-w-[70%] items-center justify-end gap-2">
                          {upBusy === key ? (
                            <span className="shrink-0 text-[11px] text-azure-600">Uploading…</span>
                          ) : null}
                          <input
                            id={inputId}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            disabled={upBusy !== null}
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              e.target.value = "";
                              void upload(key, f);
                            }}
                          />
                          <label
                            htmlFor={inputId}
                            title={displayName ? displayName : hasFile ? "Tap to choose a different file" : undefined}
                            className={`min-w-0 cursor-pointer truncate text-right text-sm font-semibold ${
                              hasFile
                                ? "text-azure-700 underline decoration-azure-300 underline-offset-2"
                                : "rounded-md border border-ink-200 bg-white px-3 py-1.5 text-ink-800 shadow-sm hover:bg-ink-50"
                            } ${upBusy !== null ? "pointer-events-none opacity-50" : ""}`}
                          >
                            {rightLabel}
                          </label>
                        </div>
                      ) : (
                        <span className="min-w-0 max-w-[70%] truncate text-right text-xs text-ink-600">
                          {docDisplayNames[key] ?? "Uploaded"}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <>
            <h3 className="text-xs font-semibold text-ink-800">Document uploads</h3>
            <p className="mt-2 text-sm text-ink-700">
              {verificationNorm === "pending" && allKycSlotsFilled
                ? "All required files are on file and under review. You cannot add or replace uploads until the library requests new documents (they will set your account to “resubmit requested”)."
                : verificationNorm === "rejected"
                  ? "Uploads are closed. Please contact the library. When staff are ready, they can request a new upload from the admin dashboard."
                  : verificationNorm === "approved"
                    ? "No further uploads are needed while you remain verified."
                    : "Uploads are not available in your current verification state."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
