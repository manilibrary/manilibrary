"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { FEEDBACK_COMMENT_MAX } from "@/lib/feedback/member-feedback";

type Feedback = {
  rating: number;
  comment: string;
  submittedAt: string;
  approved: boolean;
  editable: boolean;
  editAvailableFrom: string | null;
};

function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating out of 5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          aria-pressed={value === n}
          onClick={() => onChange(n)}
          className={`text-xl transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            n <= value ? "text-amber-400" : "text-ink-200 hover:text-amber-200"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function MemberFeedbackCard() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/me/feedback", { credentials: "include" });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        feedback?: Feedback | null;
      };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not load feedback.");
      const fb = j.feedback ?? null;
      setFeedback(fb);
      if (fb) {
        setRating(fb.rating);
        setComment(fb.comment);
        setEditing(false);
      } else {
        setRating(5);
        setComment("");
        setEditing(true);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load feedback.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/me/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; feedback?: Feedback };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not save feedback.");
      setFeedback(j.feedback ?? null);
      setEditing(false);
      setMsg(j.feedback?.approved ? "Feedback updated." : "Feedback saved. It will appear on the site after admin approval.");
      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save feedback.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete your feedback?")) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/me/feedback", { method: "DELETE", credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not delete feedback.");
      setFeedback(null);
      setRating(5);
      setComment("");
      setEditing(true);
      setMsg("Feedback deleted.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete feedback.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
        <p className="text-sm text-ink-500">Loading feedback…</p>
      </div>
    );
  }

  const showForm = !feedback || editing;
  const canEdit = feedback?.editable ?? true;

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-azure-600">Your feedback</h2>
          <p className="mt-1 text-sm text-ink-600">
            Share your experience at Mani Library. Approved reviews appear on the homepage.
          </p>
        </div>
        {feedback ? (
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
              feedback.approved
                ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                : "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
            }`}
          >
            {feedback.approved ? "Live on site" : "Pending approval"}
          </span>
        ) : null}
      </div>

      {feedback && !editing ? (
        <div className="mt-4 space-y-3 rounded-xl border border-ink-100 bg-ink-50/60 p-4">
          <StarPicker value={feedback.rating} onChange={() => {}} disabled />
          <p className="text-sm leading-relaxed text-ink-800">{feedback.comment}</p>
          {!canEdit ? (
            <p className="text-xs text-ink-500">
              You can edit or delete after{" "}
              {feedback.editAvailableFrom
                ? new Date(feedback.editAvailableFrom).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })
                : "—"}{" "}
              (30 days from posting).
            </p>
          ) : (
            <p className="text-xs text-ink-500">You can edit or delete your review.</p>
          )}
          {canEdit ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(true)}
                className="rounded-full bg-azure-500 px-4 py-2 text-xs font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove()}
                className="rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showForm ? (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {feedback && editing && canEdit ? (
            <p className="text-xs text-ink-500">You can save changes or delete your review.</p>
          ) : null}
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink-500">Rating</p>
            <StarPicker value={rating} onChange={setRating} disabled={busy} />
          </div>
          <div>
            <label
              htmlFor="member-feedback-comment"
              className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-ink-500"
            >
              Your review
            </label>
            <textarea
              id="member-feedback-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={busy}
              required
              maxLength={FEEDBACK_COMMENT_MAX}
              rows={4}
              placeholder="What did you like about studying here?"
              className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15 disabled:opacity-50"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={busy || !comment.trim() || Boolean(feedback && editing && !canEdit)}
              className="rounded-full bg-azure-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-azure-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {feedback ? "Save changes" : "Submit feedback"}
            </button>
            {feedback && editing ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(false);
                    setRating(feedback.rating);
                    setComment(feedback.comment);
                    setErr(null);
                  }}
                  className="rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                {canEdit ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove()}
                    className="rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete feedback
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </form>
      ) : null}

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
    </div>
  );
}
