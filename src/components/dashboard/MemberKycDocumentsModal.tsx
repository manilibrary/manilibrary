"use client";

import { useCallback, useEffect, useState } from "react";

const DOC_ORDER = ["aadhaar_front", "aadhaar_back", "student_id"] as const;

const DOC_LABELS: Record<string, string> = {
  aadhaar_front: "Aadhaar (front)",
  aadhaar_back: "Aadhaar (back)",
  student_id: "Student ID",
};

export type MemberKycDetails = {
  verification_status: string;
  aadhaar_last_four: string | null;
  student_roll_number: string | null;
  institution_type: string | null;
  preparing_for: string | null;
  device_user_id: number | null;
};

type DocItem = { doc_type: string; content_type: string | null; signedUrl: string };

type Props = {
  userId: string;
  memberTitle: string;
  details: MemberKycDetails;
  onClose: () => void;
  onAfterDecision?: (memberUserId: string) => void;
};

function verificationLabel(s: string): string {
  const n = (s || "none").toLowerCase();
  if (n === "approved") return "Verified";
  if (n === "pending") return "Pending review";
  if (n === "rejected") return "Rejected";
  if (n === "resubmit") return "Resubmit requested";
  return "Not submitted";
}

function formatInstitution(t: string | null): string {
  if (!t) return "—";
  const x = t.replace(/_/g, " ");
  return x.charAt(0).toUpperCase() + x.slice(1);
}

export default function MemberKycDocumentsModal({
  userId,
  memberTitle,
  details,
  onClose,
  onAfterDecision,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [memberNote, setMemberNote] = useState("");
  const [respondBusy, setRespondBusy] = useState(false);
  const [respondErr, setRespondErr] = useState<string | null>(null);
  const [confirmReviewed, setConfirmReviewed] = useState(false);

  const isPending = (details.verification_status || "none").toLowerCase() === "pending";

  useEffect(() => {
    let cancelled = false;
    const tid = window.setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      setFetchErr(null);
      setOpenDoc(null);
      setConfirmReviewed(false);
      setMemberNote("");
      setRespondErr(null);
      void (async () => {
        try {
          const res = await fetch(`/api/admin/members/${encodeURIComponent(userId)}/kyc-documents`, {
            cache: "no-store",
          });
          const j = (await res.json()) as {
            ok?: boolean;
            error?: string;
            hint?: string;
            documents?: DocItem[];
          };
          if (cancelled) return;
          if (!res.ok || !j.ok) {
            const parts = [j.error, j.hint].filter(Boolean);
            setFetchErr(parts.length ? parts.join(" — ") : "Could not load documents.");
            setDocuments([]);
            return;
          }
          setDocuments(j.documents ?? []);
        } catch (e) {
          if (!cancelled) setFetchErr(e instanceof Error ? e.message : "Network error.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const byType = new Map(documents.map((d) => [d.doc_type, d]));
  const missingDocLabels = DOC_ORDER.filter((t) => !byType.get(t)).map((t) => DOC_LABELS[t] ?? t);

  const submitRespond = useCallback(
    async (action: "reject" | "request_resubmit") => {
      setRespondErr(null);
      const trimmed = memberNote.trim();
      if (action === "request_resubmit" && trimmed.length < 3) {
        setRespondErr("Add a short note to the member explaining what to fix or re-upload (at least 3 characters).");
        return;
      }
      setRespondBusy(true);
      try {
        const res = await fetch("/api/admin/profiles/verification-respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            action,
            student_message: trimmed.length ? trimmed : null,
          }),
        });
        const j = (await res.json()) as { error?: string; ok?: boolean };
        if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not update.");
        onAfterDecision?.(userId);
        onClose();
      } catch (e) {
        setRespondErr(e instanceof Error ? e.message : "Failed.");
      } finally {
        setRespondBusy(false);
      }
    },
    [userId, memberNote, onAfterDecision, onClose],
  );

  const submitApprove = useCallback(async () => {
    if (!confirmReviewed) return;
    setRespondErr(null);
    setRespondBusy(true);
    try {
      const res = await fetch("/api/admin/profiles/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const j = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not approve.");
      onAfterDecision?.(userId);
      onClose();
    } catch (e) {
      setRespondErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setRespondBusy(false);
    }
  }, [userId, confirmReviewed, onAfterDecision, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(92vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kyc-modal-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div>
            <h2 id="kyc-modal-title" className="text-base font-semibold text-ink-900">
              KYC review
            </h2>
            <p className="mt-1 text-sm text-ink-600">{memberTitle}</p>
            <p className="mt-1 text-xs text-ink-500">Document links expire in about one hour.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Details on file</h3>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-500">Verification</dt>
                <dd className="text-right font-medium text-ink-900">{verificationLabel(details.verification_status)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-500">Device user ID</dt>
                <dd className="font-mono text-right text-ink-900">
                  {details.device_user_id != null ? String(details.device_user_id).padStart(4, "0") : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-500">Aadhaar (last 4)</dt>
                <dd className="font-mono text-right text-ink-900">
                  {details.aadhaar_last_four ? `····${details.aadhaar_last_four}` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-500">Roll / ID</dt>
                <dd className="max-w-[60%] truncate text-right text-ink-900" title={details.student_roll_number ?? undefined}>
                  {details.student_roll_number ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-500">Institution</dt>
                <dd className="text-right text-ink-900">{formatInstitution(details.institution_type)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-500">Preparing for</dt>
                <dd className="max-w-[60%] text-right text-ink-900">{details.preparing_for?.trim() || "—"}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Uploaded files</h3>
            {loading ? (
              <p className="mt-3 text-sm text-ink-600">Loading files…</p>
            ) : fetchErr ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {fetchErr}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-ink-100 rounded-xl border border-ink-100">
                {DOC_ORDER.map((docType) => {
                  const d = byType.get(docType);
                  const label = DOC_LABELS[docType] ?? docType;
                  const expanded = openDoc === docType;
                  return (
                    <li key={docType} className="bg-white px-3 py-3 first:rounded-t-xl last:rounded-b-xl">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-ink-900">{label}</span>
                        {d ? (
                          <button
                            type="button"
                            onClick={() => setOpenDoc(expanded ? null : docType)}
                            className="rounded-full border border-azure-200 bg-azure-50 px-3 py-1 text-xs font-semibold text-azure-800 hover:bg-azure-100"
                          >
                            {expanded ? "Hide" : "View"}
                          </button>
                        ) : (
                          <span className="text-xs text-ink-400">Not uploaded</span>
                        )}
                      </div>
                      {d && expanded ? (
                        <div className="mt-3 border-t border-ink-100 pt-3">
                          {(d.content_type ?? "").includes("pdf") ? (
                            <div className="space-y-2">
                              <a
                                href={d.signedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-azure-600 hover:text-azure-700"
                              >
                                Open PDF in new tab →
                              </a>
                              <iframe
                                title={label}
                                src={d.signedUrl}
                                className="h-[min(45vh,320px)] w-full rounded-lg border border-ink-200 bg-ink-50"
                              />
                            </div>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element -- time-limited signed URL from Supabase
                            <img
                              src={d.signedUrl}
                              alt={label}
                              className="max-h-[min(50vh,360px)] w-full rounded-lg border border-ink-200 object-contain"
                            />
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {isPending && missingDocLabels.length > 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
              Missing uploads: {missingDocLabels.join(", ")}. You can still reject or request a resubmit; approving is
              allowed only after you are satisfied (checkbox below).
            </p>
          ) : null}

          {!isPending ? (
            <p className="text-xs leading-relaxed text-ink-600">
              {details.verification_status?.toLowerCase() === "approved"
                ? "This member is already verified. This dialog is read-only."
                : "Use the members list when this member submits again (status pending) to approve or send feedback."}
            </p>
          ) : null}
        </div>

        {isPending ? (
          <div className="shrink-0 space-y-3 border-t border-ink-200 bg-ink-50/80 px-5 py-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-900">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-ink-300"
                checked={confirmReviewed}
                onChange={(e) => setConfirmReviewed(e.target.checked)}
                disabled={respondBusy}
              />
              <span>
                I have reviewed this member&apos;s profile fields and uploaded files against our library policy and am
                ready to record a decision.
              </span>
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-ink-700">Message to member (required for &quot;Request re-upload&quot;)</span>
              <textarea
                className="min-h-[3.5rem] resize-y rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900"
                placeholder="e.g. Aadhaar back is unreadable — please upload a clearer photo. Student ID must show the full academic year."
                value={memberNote}
                onChange={(e) => setMemberNote(e.target.value)}
                maxLength={2000}
                disabled={respondBusy}
              />
            </label>

            {respondErr ? (
              <p className="text-sm text-red-700" role="alert">
                {respondErr}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={respondBusy || !confirmReviewed}
                onClick={() => void submitApprove()}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {respondBusy ? "…" : "Approve & mark verified"}
              </button>
              <button
                type="button"
                disabled={respondBusy}
                onClick={() => void submitRespond("request_resubmit")}
                className="rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-amber-200/80 disabled:opacity-50"
              >
                Request re-upload
              </button>
              <button
                type="button"
                disabled={respondBusy}
                onClick={() => void submitRespond("reject")}
                className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-ink-600">
              <span className="font-medium text-ink-800">Request re-upload</span> sets the member to &quot;resubmit requested&quot;
              and shows your note on their account. <span className="font-medium text-ink-800">Reject</span> closes the case;
              optional note is still sent when provided.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
