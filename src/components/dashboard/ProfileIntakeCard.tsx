"use client";

import { useCallback, useEffect, useState } from "react";

export type ProfileIntakeInitial = {
  aadhaar_last_four: string | null;
  student_roll_number: string | null;
  institution_type: string | null;
  preparing_for: string | null;
  verification_status: string;
};

type Props = {
  initial: ProfileIntakeInitial;
  /** Doc types that already have a file in verification_documents (any of the user's requests). */
  uploadedDocs?: Record<string, boolean>;
  onSaved?: () => void;
};

const INSTITUTIONS = [
  { value: "", label: "Select…" },
  { value: "school", label: "School" },
  { value: "college", label: "College" },
  { value: "freelance", label: "Freelance / self-study" },
  { value: "other", label: "Other" },
];

function statusBadge(s: string) {
  const norm = s?.toLowerCase() ?? "none";
  if (norm === "approved") return { cls: "bg-emerald-100 text-emerald-800", label: "Verified" };
  if (norm === "pending") return { cls: "bg-amber-100 text-amber-900", label: "Pending review" };
  if (norm === "rejected") return { cls: "bg-red-100 text-red-800", label: "Rejected" };
  if (norm === "resubmit") return { cls: "bg-violet-100 text-violet-900", label: "Resubmit requested" };
  return { cls: "bg-ink-100 text-ink-700", label: "Not submitted" };
}

const KYC_DOC_KEYS = ["aadhaar_front", "aadhaar_back", "student_id"] as const;

export default function ProfileIntakeCard({ initial, uploadedDocs = {}, onSaved }: Props) {
  const [last4, setLast4] = useState(initial.aadhaar_last_four ?? "");
  const [roll, setRoll] = useState(initial.student_roll_number ?? "");
  const [institution, setInstitution] = useState(initial.institution_type ?? "");
  const [preparing, setPreparing] = useState(initial.preparing_for ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [upBusy, setUpBusy] = useState<string | null>(null);
  const [upErr, setUpErr] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setLast4(initial.aadhaar_last_four ?? "");
      setRoll(initial.student_roll_number ?? "");
      setInstitution(initial.institution_type ?? "");
      setPreparing(initial.preparing_for ?? "");
    });
  }, [initial]);

  const verificationNorm = (initial.verification_status || "none").toLowerCase();
  const allKycSlotsFilled = KYC_DOC_KEYS.every((k) => uploadedDocs[k]);
  const allowUploads =
    verificationNorm === "none" ||
    verificationNorm === "resubmit" ||
    (verificationNorm === "pending" && !allKycSlotsFilled);
  const v = statusBadge(initial.verification_status);

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
      onSaved?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }, [last4, roll, institution, preparing, onSaved]);

  const upload = useCallback(
    async (docType: "aadhaar_front" | "aadhaar_back" | "student_id", file: File | null) => {
      if (!file) return;
      setUpErr(null);
      setUpBusy(docType);
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("docType", docType);
        const res = await fetch("/api/me/verification/document", { method: "POST", body: fd });
        const j = (await res.json()) as { error?: string; hint?: string; ok?: boolean };
        if (!res.ok || !j.ok) {
          const parts = [j.error, j.hint].filter(Boolean);
          throw new Error(parts.length ? parts.join(" — ") : "Upload failed.");
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

  return (
    <div className="w-full space-y-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
      {verificationNorm === "approved" ? (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-emerald-950"
          role="status"
        >
          <p className="text-sm font-semibold">You are a verified customer</p>
          <p className="mt-1 text-xs leading-relaxed text-emerald-900/90">
            Your ID documents have been approved. Thank you — you do not need to upload again unless the library asks
            you to replace them.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-azure-600">Profile &amp; KYC</h2>
          <p className="mt-1 text-sm text-ink-600">
            {verificationNorm === "approved" ? (
              <>You can still update profile fields below. Document uploads stay closed.</>
            ) : verificationNorm === "pending" && !allKycSlotsFilled ? (
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
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${v.cls}`}>{v.label}</span>
      </div>

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
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveIntake()}
            className="rounded-full bg-azure-500 px-4 py-2 text-sm font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save details"}
          </button>
          <div className="min-h-[1.25rem]">
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

      <div className="border-t border-ink-100 pt-4">
        {allowUploads ? (
          <>
            <h3 className="text-xs font-semibold text-ink-800">Upload documents (optional, max 5 MB each)</h3>
            <p className="mt-1 text-xs text-ink-500">
              JPEG, PNG, WebP, or PDF (max 5 MB each). While your review is open, you can add missing files but not
              replace ones already uploaded unless staff request a resubmit.
            </p>
            {upErr ? (
              <p className="mt-2 text-xs text-red-700" role="alert">
                {upErr}
              </p>
            ) : null}
            <ul className="mt-3 space-y-3 text-xs">
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
                return (
                  <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="w-28 shrink-0 text-ink-600">{label}</span>
                    {hasFile ? (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
                        Uploaded
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] text-ink-400">Not uploaded</span>
                    )}
                    {showPicker ? (
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        disabled={upBusy !== null}
                        className="min-w-0 flex-1 text-ink-700 sm:max-w-[220px]"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          e.target.value = "";
                          void upload(key, f);
                        }}
                      />
                    ) : null}
                    {upBusy === key ? <span className="text-azure-600">Uploading…</span> : null}
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
