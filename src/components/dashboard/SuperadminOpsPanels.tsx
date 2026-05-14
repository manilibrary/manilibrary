"use client";

import { useCallback, useEffect, useState } from "react";

import MemberKycDocumentsModal, { type MemberKycDetails } from "@/components/dashboard/MemberKycDocumentsModal";
import { SuperadminHealthSkeleton } from "@/components/ui/ContentSkeletons";

function shortUuid(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

function kycDetailsFromRecord(p: Record<string, unknown>): MemberKycDetails {
  const mn = p.device_user_id;
  return {
    verification_status: String(p.verification_status ?? "none"),
    aadhaar_last_four: (typeof p.aadhaar_last_four === "string" ? p.aadhaar_last_four : null) ?? null,
    student_roll_number: (typeof p.student_roll_number === "string" ? p.student_roll_number : null) ?? null,
    institution_type: (typeof p.institution_type === "string" ? p.institution_type : null) ?? null,
    preparing_for: (typeof p.preparing_for === "string" ? p.preparing_for : null) ?? null,
    device_user_id: typeof mn === "number" ? mn : null,
  };
}

type SearchPayload = {
  memberships: Record<string, unknown>[];
  profiles: Record<string, unknown>[];
  payments: Record<string, unknown>[];
};

type HealthPayload = {
  razorpay: { keyId: boolean; keySecret: boolean };
  etime: {
    apiOrigin: boolean;
    basicCredentials: boolean;
    authorizationHeader: boolean;
    corporateUserPass: boolean;
    ready: boolean;
  };
};

type PayRow = {
  id: string;
  user_id: string;
  membership_id: string | null;
  amount_rupees: number;
  status: string;
  provider: string | null;
  provider_payment_id: string | null;
  created_at: string;
  member_label: string;
  device_user_id: number | null;
};

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 bg-white px-3 py-2 text-xs">
      <span className="text-ink-600">{label}</span>
      <span className={ok ? "font-semibold text-emerald-700" : "font-semibold text-amber-800"}>
        {ok ? "Set" : "Missing"}
      </span>
    </div>
  );
}

export default function SuperadminOpsPanels() {
  const [searchQ, setSearchQ] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searchRes, setSearchRes] = useState<SearchPayload | null>(null);

  const [kycPreview, setKycPreview] = useState<{
    userId: string;
    title: string;
    details: MemberKycDetails;
  } | null>(null);

  const runSearch = useCallback(async () => {
    setSearchBusy(true);
    setSearchErr(null);
    try {
      const params = new URLSearchParams();
      if (searchQ.trim()) params.set("q", searchQ.trim());
      const res = await fetch(`/api/superadmin/search?${params.toString()}`, { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; error?: string } & Partial<SearchPayload>;
      if (!res.ok || !j.ok) {
        setSearchErr(j.error ?? "Search failed.");
        setSearchRes(null);
        return;
      }
      setSearchRes({
        memberships: j.memberships ?? [],
        profiles: j.profiles ?? [],
        payments: j.payments ?? [],
      });
    } catch (e) {
      setSearchErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSearchBusy(false);
    }
  }, [searchQ]);

  const [profileId, setProfileId] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    user_id: string;
    full_name: string;
    device_user_id: number;
    email: string | null;
    is_admin: boolean;
    is_superadmin: boolean;
    verification_status?: string | null;
    aadhaar_last_four?: string | null;
    student_roll_number?: string | null;
    institution_type?: string | null;
    preparing_for?: string | null;
  } | null>(null);
  const [draftAdmin, setDraftAdmin] = useState(false);
  const [draftSuper, setDraftSuper] = useState(false);
  const [deleteAck, setDeleteAck] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const loadProfile = useCallback(async (userIdOverride?: string) => {
    const id = (userIdOverride ?? profileId).trim();
    if (!id) return;
    setProfileBusy(true);
    setProfileErr(null);
    setProfileMsg(null);
    try {
      const res = await fetch(`/api/superadmin/profiles/${encodeURIComponent(id)}`, { cache: "no-store" });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        profile?: {
          user_id: string;
          full_name: string;
          device_user_id: number;
          email: string | null;
          is_admin: boolean;
          is_superadmin: boolean;
          verification_status?: string | null;
          aadhaar_last_four?: string | null;
          student_roll_number?: string | null;
          institution_type?: string | null;
          preparing_for?: string | null;
        };
      };
      if (!res.ok || !j.ok || !j.profile) {
        setProfile(null);
        setProfileErr(j.error ?? "Could not load profile.");
        return;
      }
      setProfileId(j.profile.user_id);
      setProfile(j.profile);
      setDraftAdmin(Boolean(j.profile.is_admin));
      setDraftSuper(Boolean(j.profile.is_superadmin));
      setDeleteAck(false);
      setDeleteErr(null);
    } catch (e) {
      setProfileErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setProfileBusy(false);
    }
  }, [profileId]);

  const saveProfile = useCallback(async () => {
    if (!profile) return;
    setProfileBusy(true);
    setProfileErr(null);
    setProfileMsg(null);
    try {
      const res = await fetch(`/api/superadmin/profiles/${encodeURIComponent(profile.user_id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_admin: draftAdmin, is_superadmin: draftSuper }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; profile?: typeof profile };
      if (!res.ok || !j.ok || !j.profile) {
        setProfileErr(j.error ?? "Save failed.");
        return;
      }
      setProfile(j.profile);
      setProfileMsg("Saved.");
      setDeleteAck(false);
    } catch (e) {
      setProfileErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setProfileBusy(false);
    }
  }, [profile, draftAdmin, draftSuper]);

  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/superadmin/health", { cache: "no-store" });
        const j = (await res.json()) as { ok?: boolean; error?: string } & Partial<{ razorpay: HealthPayload["razorpay"]; etime: HealthPayload["etime"] }>;
        if (cancelled) return;
        if (!res.ok || !j.ok || !j.razorpay || !j.etime) {
          setHealthErr(j.error ?? "Could not load health.");
          return;
        }
        setHealth({ razorpay: j.razorpay, etime: j.etime });
      } catch (e) {
        if (!cancelled) setHealthErr(e instanceof Error ? e.message : "Network error.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [payFilter, setPayFilter] = useState("");
  const [payRows, setPayRows] = useState<PayRow[]>([]);
  const [payBusy, setPayBusy] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    setPayBusy(true);
    setPayErr(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (payFilter === "pending" || payFilter === "paid" || payFilter === "failed" || payFilter === "refunded") {
        params.set("status", payFilter);
      }
      const res = await fetch(`/api/superadmin/payments?${params.toString()}`, { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; error?: string; items?: PayRow[] };
      if (!res.ok || !j.ok) {
        setPayErr(j.error ?? "Could not load payments.");
        setPayRows([]);
        return;
      }
      setPayRows(j.items ?? []);
    } catch (e) {
      setPayErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setPayBusy(false);
    }
  }, [payFilter]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadPayments();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadPayments]);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Global search</p>
        <p className="mt-1 text-sm text-ink-600">
          UUID (membership id, payment id, or user id), email fragment, 1–4 digit device user id, or Razorpay{" "}
          <span className="font-mono">pay_…</span> id.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <input
            className="min-w-[16rem] flex-1 rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search…"
          />
          <button
            type="button"
            disabled={searchBusy}
            onClick={() => void runSearch()}
            className="rounded-full bg-azure-500 px-4 py-2 text-sm font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
          >
            {searchBusy ? "Searching…" : "Search"}
          </button>
        </div>
        {searchErr ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{searchErr}</p>
        ) : null}
        {searchRes ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div>
              <p className="text-xs font-semibold text-ink-700">Profiles ({searchRes.profiles.length})</p>
              <ul className="mt-2 space-y-2 text-xs">
                {searchRes.profiles.map((p) => (
                  <li key={String(p.user_id)} className="rounded-lg border border-ink-100 bg-surface-muted/50 p-2">
                    <p className="font-medium text-ink-900">{String(p.full_name)}</p>
                    <p className="font-mono text-ink-500">#{String(p.device_user_id).padStart(4, "0")}</p>
                    <p className="truncate text-ink-500">{String(p.email ?? "")}</p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      <button
                        type="button"
                        className="text-azure-600 hover:underline"
                        onClick={() => void loadProfile(String(p.user_id))}
                      >
                        Open in profile editor →
                      </button>
                      <button
                        type="button"
                        className="text-azure-600 hover:underline"
                        onClick={() =>
                          setKycPreview({
                            userId: String(p.user_id),
                            title: `${String(p.full_name)}${p.email ? ` — ${String(p.email)}` : ""}`,
                            details: kycDetailsFromRecord(p as Record<string, unknown>),
                          })
                        }
                      >
                        {String(p.verification_status ?? "").toLowerCase() === "pending" ? "Review KYC" : "View KYC"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-700">Memberships ({searchRes.memberships.length})</p>
              <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-xs">
                {searchRes.memberships.map((m) => (
                  <li key={String(m.id)} className="rounded-lg border border-ink-100 p-2 text-xs">
                    <p className="font-medium text-ink-900" title={String(m.member_label ?? m.user_id)}>
                      {String(m.member_label ?? m.user_id)}
                    </p>
                    <p className="mt-0.5 text-ink-600">
                      {String(m.plan_kind)} · {String(m.status)}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-ink-400" title={String(m.id)}>
                      {shortUuid(String(m.id))}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-700">Payments ({searchRes.payments.length})</p>
              <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-xs">
                {searchRes.payments.map((p) => (
                  <li key={String(p.id)} className="rounded-lg border border-ink-100 p-2 text-xs">
                    <p className="font-medium text-ink-900" title={String(p.member_label ?? p.user_id)}>
                      {String(p.member_label ?? p.user_id)}
                    </p>
                    <p className="mt-0.5 text-ink-600">
                      ₹{Number(p.amount_rupees).toLocaleString("en-IN")} · {String(p.status)}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-ink-400" title={String(p.id)}>
                      {shortUuid(String(p.id))}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Profile flags</p>
        <p className="mt-1 text-sm text-ink-600">
          Load a profile by <span className="font-mono">user_id</span> (UUID). Only <span className="font-mono">is_admin</span> and{" "}
          <span className="font-mono">is_superadmin</span> can be changed here. Device user ids stay fixed in the database.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <input
            className="min-w-[16rem] flex-1 rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value.trim())}
            placeholder="user_id (uuid)"
          />
          <button
            type="button"
            disabled={profileBusy}
            onClick={() => void loadProfile()}
            className="rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            Load
          </button>
        </div>
        {profileErr ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{profileErr}</p>
        ) : null}
        {profileMsg ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{profileMsg}</p>
        ) : null}
        {profile ? (
          <div className="mt-6 space-y-4 rounded-xl border border-ink-100 bg-surface-muted/40 p-4">
            <div>
              <p className="text-sm font-semibold text-ink-900">{profile.full_name}</p>
              <p className="font-mono text-xs text-ink-500">
                #{String(profile.device_user_id).padStart(4, "0")} · {profile.email ?? "no email"}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draftAdmin} onChange={(e) => setDraftAdmin(e.target.checked)} />
              Library admin (<span className="font-mono">is_admin</span>)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draftSuper} onChange={(e) => setDraftSuper(e.target.checked)} />
              Superadmin (<span className="font-mono">is_superadmin</span>)
            </label>
            <button
              type="button"
              disabled={profileBusy}
              onClick={() => void saveProfile()}
              className="rounded-full bg-azure-500 px-4 py-2 text-sm font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
            >
              {profileBusy ? "Saving…" : "Save flags"}
            </button>
            <button
              type="button"
              disabled={profileBusy}
              onClick={() =>
                setKycPreview({
                  userId: profile.user_id,
                  title: `${profile.full_name}${profile.email ? ` — ${profile.email}` : ""}`,
                  details: {
                    verification_status: profile.verification_status ?? "none",
                    aadhaar_last_four: profile.aadhaar_last_four ?? null,
                    student_roll_number: profile.student_roll_number ?? null,
                    institution_type: profile.institution_type ?? null,
                    preparing_for: profile.preparing_for ?? null,
                    device_user_id: profile.device_user_id,
                  },
                })
              }
              className="ml-2 rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-50"
            >
              {(profile.verification_status ?? "").toLowerCase() === "pending" ? "Review KYC" : "View KYC"}
            </button>
            <div className="mt-6 border-t border-red-100 pt-4">
              <p className="text-sm font-semibold text-red-800">Danger zone</p>
              <p className="mt-1 text-xs leading-relaxed text-red-800/90">
                Permanently deletes this Auth account and linked library data: profile, KYC storage objects, memberships,
                payments, verification rows, export audit rows for this member, membership event rows, and clears this
                member from processed-by fields on archived attendance days. This cannot be undone.
              </p>
              <label className="mt-3 flex items-start gap-2 text-xs text-red-900">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={deleteAck}
                  onChange={(e) => setDeleteAck(e.target.checked)}
                />
                <span>I understand this will permanently delete this account and all linked data.</span>
              </label>
              {deleteErr ? <p className="mt-2 text-xs text-red-800">{deleteErr}</p> : null}
              <button
                type="button"
                disabled={deleteBusy || !deleteAck || profileBusy}
                className="mt-3 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                onClick={() => {
                  void (async () => {
                    if (!profile || !deleteAck) return;
                    setDeleteErr(null);
                    setDeleteBusy(true);
                    try {
                      const res = await fetch(`/api/superadmin/profiles/${encodeURIComponent(profile.user_id)}`, {
                        method: "DELETE",
                      });
                      const j = (await res.json()) as { ok?: boolean; error?: string };
                      if (!res.ok || !j.ok) {
                        setDeleteErr(j.error ?? "Delete failed.");
                        return;
                      }
                      setProfileMsg("User and all linked data were deleted.");
                      setProfile(null);
                      setProfileId("");
                      setDeleteAck(false);
                    } catch (e) {
                      setDeleteErr(e instanceof Error ? e.message : "Delete failed.");
                    } finally {
                      setDeleteBusy(false);
                    }
                  })();
                }}
              >
                {deleteBusy ? "Deleting…" : "Delete user permanently"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Environment health</p>
          <p className="mt-1 text-xs text-ink-500">Presence only — secrets are never returned.</p>
          {healthErr ? (
            <p className="mt-3 text-sm text-red-700">{healthErr}</p>
          ) : health ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-ink-700">Online payments</p>
              <Flag ok={health.razorpay.keyId} label="Payment key set" />
              <Flag ok={health.razorpay.keySecret} label="Payment secret set" />
              <p className="pt-3 text-xs font-semibold text-ink-700">Biometric gate</p>
              <Flag ok={health.etime.apiOrigin} label="Gate server address set" />
              <Flag ok={health.etime.ready} label="Gate login details ready" />
            </div>
          ) : (
            <SuperadminHealthSkeleton />
          )}
        </section>

        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Payments browser</p>
              <p className="mt-1 text-xs text-ink-500">Latest rows across all members.</p>
            </div>
            <div className="flex gap-2">
              <select
                className="rounded-lg border border-ink-200 px-2 py-1 text-xs"
                value={payFilter}
                onChange={(e) => setPayFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="pending">pending</option>
                <option value="paid">paid</option>
                <option value="failed">failed</option>
                <option value="refunded">refunded</option>
              </select>
              <button
                type="button"
                disabled={payBusy}
                onClick={() => void loadPayments()}
                className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-50"
              >
                Refresh
              </button>
            </div>
          </div>
          {payErr ? (
            <p className="mt-3 text-sm text-red-700">{payErr}</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-ink-100 font-mono uppercase tracking-widest text-ink-500">
                  <tr>
                    <th className="py-2 pr-2">When</th>
                    <th className="py-2 pr-2">Member</th>
                    <th className="py-2 pr-2">Library no.</th>
                    <th className="py-2 pr-2">₹</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Payment ref.</th>
                    <th className="py-2">Membership ref.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 text-ink-800">
                  {payRows.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-2 font-mono whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="py-2 pr-2 max-w-[14rem]">
                        <div className="font-medium" title={r.member_label}>
                          {r.member_label}
                        </div>
                      </td>
                      <td className="py-2 pr-2 font-mono text-[11px]">
                        {r.device_user_id != null ? String(r.device_user_id).padStart(4, "0") : "—"}
                      </td>
                      <td className="py-2 pr-2 font-mono">{Number(r.amount_rupees).toLocaleString("en-IN")}</td>
                      <td className="py-2 pr-2 capitalize">{r.status}</td>
                      <td className="py-2 pr-2 font-mono text-[10px] text-ink-600" title={r.id}>
                        {shortUuid(r.id)}
                      </td>
                      <td className="py-2 font-mono text-[10px] text-ink-600" title={r.membership_id ?? ""}>
                        {r.membership_id ? shortUuid(r.membership_id) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {kycPreview ? (
        <MemberKycDocumentsModal
          userId={kycPreview.userId}
          memberTitle={kycPreview.title}
          details={kycPreview.details}
          onClose={() => setKycPreview(null)}
          onAfterDecision={(uid) => {
            void runSearch();
            void loadProfile(uid);
            setKycPreview(null);
          }}
        />
      ) : null}
    </div>
  );
}
