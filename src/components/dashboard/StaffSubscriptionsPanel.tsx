"use client";

import { useEffect, useMemo, useState } from "react";

import { formatDateDdMmYyyy } from "@/lib/date-format";
import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";

type MembershipRow = {
  id: string;
  user_id: string;
  plan_kind: string;
  status: string;
  seat_number: number | null;
  seat_label: string | null;
  starts_at: string | null;
  ends_at: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
};

type ProfileMini = {
  user_id: string;
  full_name: string;
  member_number: number;
  email: string | null;
};

type Group = "active" | "expiring" | "pending" | "expired" | "cancelled";

function endDateOf(r: MembershipRow): string | null {
  if (r.plan_kind === "long_term") return r.valid_until;
  return r.ends_at;
}

function classify(r: MembershipRow, today: string, nowIso: string): Group {
  if (r.status === "pending_payment") return "pending";
  if (r.status === "cancelled") return "cancelled";
  if (r.status === "expired") return "expired";
  if (r.status === "active") {
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

export default function StaffSubscriptionsPanel({
  initialGroup = "all",
}: {
  initialGroup?: "all" | Group;
}) {
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Group>(initialGroup);

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
    if (filter === "all") return classified;
    return classified.filter((x) => x.group === filter);
  }, [classified, filter]);

  if (err) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {([
          ["active", "Active", "text-emerald-700"],
          ["expiring", "Expiring soon", "text-amber-700"],
          ["pending", "Pending payment", "text-azure-700"],
          ["expired", "Expired", "text-ink-700"],
          ["cancelled", "Cancelled", "text-red-700"],
        ] as const).map(([g, label, color]) => (
          <button
            key={g}
            type="button"
            onClick={() => setFilter(filter === g ? "all" : g)}
            className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors ${
              filter === g ? "border-azure-300" : "border-ink-100 hover:border-azure-200"
            }`}
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">{label}</p>
            <p className={`mt-1 text-2xl font-semibold ${color}`}>{counts[g]}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-500">
          {filter === "all" ? "Showing all memberships." : `Filtered: ${filter}.`}
        </p>
        {filter !== "all" ? (
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="text-xs font-semibold text-azure-600 hover:text-azure-700"
          >
            Clear filter
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-surface-muted/80 font-mono text-[10px] uppercase tracking-widest text-ink-500">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Seat</th>
              <th className="px-4 py-3">Window</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-ink-500">
                  No rows.
                </td>
              </tr>
            ) : (
              visible.map(({ row: r, group }) => {
                const p = profiles[r.user_id];
                const window =
                  r.plan_kind === "long_term"
                    ? `${formatDateDdMmYyyy(r.valid_from)} → ${formatDateDdMmYyyy(r.valid_until)}`
                    : `${formatDateDdMmYyyy(r.starts_at)} → ${formatDateDdMmYyyy(r.ends_at)}`;
                return (
                  <tr key={r.id} className="text-ink-800">
                    <td className="px-4 py-3">{p?.full_name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono">
                      {p ? String(p.member_number).padStart(4, "0") : "—"}
                    </td>
                    <td className="px-4 py-3 capitalize">{r.plan_kind.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 font-mono">
                      {resolveMemberSeatDisplayLabel({
                        plan_kind: r.plan_kind,
                        seat_number: r.seat_number,
                        seat_label: r.seat_label,
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-600">{window}</td>
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
