"use client";

import { useEffect, useMemo, useState } from "react";

import { MembershipSeatTableCell } from "@/components/membership/MembershipSeatTableCell";
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy } from "@/lib/date-format";

type MembershipWindowState = "current" | "starts_future" | "ended_past" | "unknown" | "inactive";

type MembershipRow = {
  id: string;
  user_id: string;
  plan_kind: string;
  status: string;
  seat_number: string | number | null;
  starts_at: string | null;
  ends_at: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  window_state?: MembershipWindowState;
};

type ProfileMini = {
  user_id: string;
  full_name: string;
  device_user_id: number;
  email: string | null;
};

type Group = "active" | "expiring" | "pending" | "expired" | "cancelled";

/** Default table: current subscriptions only (hide checkout drafts and ended windows). */
type StatusMode = "eligible" | Group;

type PlanFilter = "all" | "long_term" | "short_term";

function endDateOf(r: MembershipRow): string | null {
  if (r.plan_kind === "long_term") return r.valid_until;
  return r.ends_at;
}

function classify(r: MembershipRow, today: string, nowIso: string): Group {
  if (r.status === "pending_payment") return "pending";
  if (r.status === "cancelled") return "cancelled";
  if (r.status === "expired") return "expired";
  if (r.status === "active") {
    if (r.window_state === "ended_past") return "expired";
    const end = endDateOf(r);
    if (!end) return "active";
    if (r.plan_kind === "long_term") {
      if (end < today) return "expired";
      const days = Math.ceil(
        (new Date(end).getTime() - new Date(today).getTime()) / (24 * 60 * 60 * 1000),
      );
      if (days <= 7) return "expiring";
      return "active";
    }
    if (end < nowIso) return "expired";
    const hours = Math.ceil((new Date(end).getTime() - Date.now()) / (60 * 60 * 1000));
    if (hours <= 6) return "expiring";
    return "active";
  }
  return "active";
}

function rowMatchesStatusMode(group: Group, mode: StatusMode): boolean {
  if (mode === "eligible") return group !== "pending" && group !== "expired";
  return group === mode;
}

function rowMatchesPlan(r: MembershipRow, plan: PlanFilter): boolean {
  if (plan === "all") return true;
  return r.plan_kind === plan;
}

function formatWindow(r: MembershipRow): string {
  if (r.plan_kind === "long_term") {
    return `${formatDateDdMmYyyy(r.valid_from)} → ${formatDateDdMmYyyy(r.valid_until)}`;
  }
  if (r.plan_kind === "short_term") {
    return `${formatDateTimeDdMmYyyy(r.starts_at)} → ${formatDateTimeDdMmYyyy(r.ends_at)}`;
  }
  return "—";
}

function GroupBadge({ g }: { g: Group }) {
  const map: Record<Group, string> = {
    active: "bg-emerald-100 text-emerald-800",
    expiring: "bg-amber-100 text-amber-800",
    pending: "bg-azure-100 text-azure-700",
    expired: "bg-ink-100 text-ink-700",
    cancelled: "bg-red-100 text-red-700",
  };
  const label: Record<Group, string> = {
    active: "Active",
    expiring: "Expiring soon",
    pending: "Pending payment",
    expired: "Expired",
    cancelled: "Cancelled",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[g]}`}>
      {label[g]}
    </span>
  );
}

const PLAN_CHIPS: { id: PlanFilter; label: string }[] = [
  { id: "all", label: "All plans" },
  { id: "short_term", label: "Short term" },
  { id: "long_term", label: "Long term" },
];

export default function StaffSubscriptionsPanel({
  initialGroup = "all",
}: {
  initialGroup?: "all" | Group;
}) {
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [err, setErr] = useState<string | null>(null);
  const [statusMode, setStatusMode] = useState<StatusMode>(() => (initialGroup === "all" ? "eligible" : initialGroup));
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/members/list", { cache: "no-store" });
        const j = (await res.json()) as {
          ok?: boolean;
          error?: string;
          rows?: MembershipRow[];
          profiles?: Record<string, ProfileMini>;
        };
        if (cancelled) return;
        if (!res.ok || !j.ok) {
          setErr(j.error ?? "Could not load subscriptions.");
          return;
        }
        setRows(j.rows ?? []);
        setProfiles(j.profiles ?? {});
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Network error.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const classified = useMemo(
    () => rows.map((r) => ({ row: r, group: classify(r, today, nowIso) })),
    [rows, today, nowIso],
  );

  const counts = useMemo(() => {
    const c: Record<Group, number> = {
      active: 0,
      expiring: 0,
      pending: 0,
      expired: 0,
      cancelled: 0,
    };
    for (const { group } of classified) c[group] += 1;
    return c;
  }, [classified]);

  const visible = useMemo(() => {
    return classified.filter(
      ({ row, group }) => rowMatchesStatusMode(group, statusMode) && rowMatchesPlan(row, planFilter),
    );
  }, [classified, statusMode, planFilter]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (statusMode === "eligible") {
      parts.push("Excluding pending payment and expired");
    } else {
      const labels: Record<Group, string> = {
        active: "Active",
        expiring: "Expiring soon",
        pending: "Pending payment",
        expired: "Expired",
        cancelled: "Cancelled",
      };
      parts.push(labels[statusMode]);
    }
    if (planFilter !== "all") {
      parts.push(planFilter === "short_term" ? "Short term only" : "Long term only");
    }
    return parts.join(" · ");
  }, [statusMode, planFilter]);

  if (err) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            ["active", "Active", "text-emerald-700"],
            ["expiring", "Expiring soon", "text-amber-700"],
            ["pending", "Pending payment", "text-azure-700"],
            ["expired", "Expired", "text-ink-700"],
            ["cancelled", "Cancelled", "text-red-700"],
          ] as const
        ).map(([g, label, color]) => (
          <button
            key={g}
            type="button"
            onClick={() => setStatusMode((m) => (m === g ? "eligible" : g))}
            className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors ${
              statusMode === g ? "border-azure-300" : "border-ink-100 hover:border-azure-200"
            }`}
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{label}</p>
            <p className={`mt-1 text-2xl font-semibold ${color}`}>{counts[g]}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PLAN_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setPlanFilter(c.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              planFilter === c.id
                ? "bg-azure-600 text-white"
                : "border border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-500">
          {visible.length} row{visible.length === 1 ? "" : "s"} · {filterSummary}
        </p>
        {statusMode !== "eligible" || planFilter !== "all" ? (
          <button
            type="button"
            onClick={() => {
              setStatusMode("eligible");
              setPlanFilter("all");
            }}
            className="text-xs font-semibold text-azure-600 hover:text-azure-700"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-surface-muted/80 font-mono text-[10px] uppercase tracking-widest text-ink-500">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Device user ID</th>
              <th
                className="px-4 py-3"
                title="Only active memberships reserve a seat; pending payment shows checkout choice only."
              >
                Seat
              </th>
              <th className="px-4 py-3">Window</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-ink-500">
                  No rows match these filters.
                </td>
              </tr>
            ) : (
              visible.map(({ row: r, group }) => {
                const p = profiles[r.user_id];
                return (
                  <tr key={r.id} className="text-ink-800">
                    <td className="px-4 py-3">{p?.full_name ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{r.plan_kind.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 font-mono">
                      {p ? String(p.device_user_id).padStart(4, "0") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <MembershipSeatTableCell
                        plan_kind={r.plan_kind}
                        seat_number={r.seat_number}
                        status={r.status}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-600">{formatWindow(r)}</td>
                    <td className="px-4 py-3">
                      <GroupBadge g={group} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
