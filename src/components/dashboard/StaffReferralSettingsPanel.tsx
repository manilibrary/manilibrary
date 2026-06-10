"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReferralSettings } from "@/lib/referrals/library-referrals";

export default function StaffReferralSettingsPanel() {
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [creditsPerReferral, setCreditsPerReferral] = useState("50");
  const [maxPerMember, setMaxPerMember] = useState("5");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/referrals/settings", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; error?: string; settings?: ReferralSettings };
      if (!res.ok || !j.ok || !j.settings) throw new Error(j.error ?? "Could not load referral settings.");
      setSettings(j.settings);
      setEnabled(j.settings.enabled);
      setCreditsPerReferral(String(j.settings.creditsPerReferral));
      setMaxPerMember(String(j.settings.maxPerMember));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load referral settings.");
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
    const credits = Number(creditsPerReferral);
    const max = Number(maxPerMember);
    if (!Number.isFinite(credits) || credits < 0) {
      setErr("Credits per referral must be a non-negative number.");
      setBusy(false);
      return;
    }
    if (!Number.isInteger(max) || max < 0) {
      setErr("Max referrals must be a whole number ≥ 0.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/referrals/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          creditsPerReferral: Math.round(credits),
          maxPerMember: max,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; settings?: ReferralSettings };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not save.");
      setSettings(j.settings ?? null);
      setMsg("Referral settings saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-ink-500">Loading referral settings…</p>;
  }

  return (
    <div className="space-y-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
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

      <label className="flex items-center gap-3 text-sm text-ink-800">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-ink-300 text-azure-500"
        />
        Referral program enabled
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-500">
            Credits per successful referral (₹)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={creditsPerReferral}
            disabled={busy}
            onChange={(e) => setCreditsPerReferral(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-900 outline-none focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-500">
            Max referrals per member
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={maxPerMember}
            disabled={busy}
            onChange={(e) => setMaxPerMember(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-900 outline-none focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15 disabled:opacity-50"
          />
        </div>
      </div>

      <p className="text-xs text-ink-500">
        Credits are awarded to the referrer only, after the new member&apos;s first paid membership. 1 credit = ₹1 at
        checkout. Credits cannot be combined with coupons.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="rounded-full bg-azure-500 px-5 py-2 text-sm font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save referral settings"}
      </button>

      {settings ? (
        <p className="text-xs text-ink-400">
          Current: {settings.enabled ? "on" : "off"} · ₹{settings.creditsPerReferral} per referral · max{" "}
          {settings.maxPerMember} per member
        </p>
      ) : null}
    </div>
  );
}
