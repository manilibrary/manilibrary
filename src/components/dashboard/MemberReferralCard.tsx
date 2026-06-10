"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import libraryInfo from "@/data/libraryInfo.json";
import { buildReferralShareMessage, type MemberReferralSummary } from "@/lib/referrals/library-referrals";

function inr(n: number): string {
  return n.toLocaleString("en-IN");
}

export default function MemberReferralCard() {
  const [data, setData] = useState<MemberReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/referrals/me", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; referral?: MemberReferralSummary | null };
      if (res.ok && j.ok) setData(j.referral ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signupUrl = data?.signupUrl ?? "";

  const shareMessage = useMemo(() => {
    if (!data?.referralCode || !signupUrl) return "";
    return buildReferralShareMessage({
      referralCode: data.referralCode,
      signupUrl,
      libraryName: libraryInfo.name,
      memberFirstName: data.memberFirstName,
    });
  }, [data?.referralCode, data?.memberFirstName, signupUrl]);

  const copyCode = async () => {
    if (!data?.referralCode) return;
    try {
      await navigator.clipboard.writeText(data.referralCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const shareInvite = async () => {
    if (!data?.referralCode || !shareMessage) return;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: `Join ${libraryInfo.name}`,
          text: shareMessage,
        });
        setShared(true);
        window.setTimeout(() => setShared(false), 2000);
        return;
      }
      await navigator.clipboard.writeText(shareMessage);
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(shareMessage);
        setShared(true);
        window.setTimeout(() => setShared(false), 2000);
      } catch {
        // ignore
      }
    }
  };

  if (loading) {
    return <p className="text-sm text-ink-500">Loading referral details…</p>;
  }

  if (!data || !data.enabled) return null;

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-ink-900">Refer friends, earn credits</h3>
      <p className="mt-1 text-sm text-ink-600">
        Share your code. When someone joins and pays for their first membership, you earn{" "}
        <strong className="font-semibold text-ink-800">₹{inr(data.creditsPerReferral)}</strong> in credits (1 credit
        = ₹1). Redeem credits on your next renewal.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 rounded-xl border border-ink-100 bg-ink-50 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Your code</p>
          <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-ink-900">
            {data.referralCode ?? "—"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void shareInvite()}
            disabled={!data.referralCode}
            className="rounded-full bg-azure-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
          >
            {shared ? "Shared!" : "Share invite"}
          </button>
          <button
            type="button"
            onClick={() => void copyCode()}
            disabled={!data.referralCode}
            className="rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            {copied ? "Copied" : "Copy code"}
          </button>
        </div>
      </div>

      {shareMessage ? (
        <p className="mt-3 rounded-xl border border-ink-100 bg-ink-50/80 px-3 py-2.5 text-xs leading-relaxed text-ink-600 whitespace-pre-line">
          {shareMessage}
        </p>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-ink-100 bg-ink-50/80 px-3 py-2.5">
          <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Credits</dt>
          <dd className="mt-0.5 font-semibold text-ink-900">₹{inr(data.creditBalance)}</dd>
        </div>
        <div className="rounded-xl border border-ink-100 bg-ink-50/80 px-3 py-2.5">
          <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Referrals used</dt>
          <dd className="mt-0.5 font-semibold text-ink-900">
            {data.referralsUsed} / {data.referralsMax}
          </dd>
        </div>
      </dl>
    </div>
  );
}
