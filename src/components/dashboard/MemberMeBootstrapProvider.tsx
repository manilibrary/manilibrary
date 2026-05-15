"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { MemberActivePlanRow } from "@/components/dashboard/MemberActiveMembershipCards";
import { CLIENT_DATA_CACHE_TTL_MS, ddcKey, setClientCache } from "@/lib/client-data-cache";
import { createClient } from "@/lib/supabase/client";

type MeAttendanceDailyRow = {
  in_time: string;
  out_time: string;
  work_time: string;
  overtime: string;
  status: string;
  date: string;
  remark: string;
};

/** Payload from `GET /api/me/today-attendance` (same shape as `MemberAttendanceCard`). */
export type MeTodayAttendancePayload = {
  ok: boolean;
  daily: MeAttendanceDailyRow | null;
  history?: MeAttendanceDailyRow[];
  attendanceDate?: string;
  today?: string;
  historyFromDmy?: string;
  note?: string | null;
  error?: string;
  hasIn?: boolean;
  hasOut?: boolean;
};

type Phase = "idle" | "loading" | "ready";

export type MemberMeBootstrapContextValue = {
  /** Library member (non-admin) or staff skip finished determining state. */
  ready: boolean;
  /** Initial member bundle fetch in flight (not used for silent refetch). */
  loading: boolean;
  /** Staff/admin — member me bundle is not fetched here. */
  skipped: boolean;
  memberUserId: string | null;
  membershipRows: MemberActivePlanRow[] | null;
  membershipError: string | null;
  attendance: MeTodayAttendancePayload | null;
  attendanceError: string | null;
  refetch: () => Promise<void>;
};

const MemberMeBootstrapContext = createContext<MemberMeBootstrapContextValue | null>(null);

async function fetchMemberBundle(userId: string): Promise<{
  membershipRows: MemberActivePlanRow[] | null;
  membershipError: string | null;
  attendance: MeTodayAttendancePayload | null;
  attendanceError: string | null;
}> {
  const supabase = createClient();

  const settled = await Promise.allSettled([
    supabase
      .from("memberships")
      .select("id, plan_kind, status, seat_number, starts_at, ends_at, valid_from, valid_until, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    fetch("/api/me/today-attendance", { cache: "no-store" }).then(async (res) => {
      const j = (await res.json()) as MeTodayAttendancePayload & { error?: string };
      if (!res.ok || !j.ok) {
        throw new Error(j.error ?? "Could not load attendance.");
      }
      return j;
    }),
  ]);

  let membershipRows: MemberActivePlanRow[] | null = null;
  let membershipError: string | null = null;
  if (settled[0].status === "fulfilled") {
    const { data, error } = settled[0].value;
    if (error) {
      membershipError = error.message;
      membershipRows = [];
    } else {
      membershipRows = (data ?? []) as MemberActivePlanRow[];
      setClientCache(ddcKey.memberships(userId), membershipRows, CLIENT_DATA_CACHE_TTL_MS);
    }
  } else {
    const r = settled[0].reason;
    membershipError = r instanceof Error ? r.message : "Could not load memberships.";
    membershipRows = [];
  }

  let attendance: MeTodayAttendancePayload | null = null;
  let attendanceError: string | null = null;
  if (settled[1].status === "fulfilled") {
    attendance = settled[1].value;
  } else {
    const r = settled[1].reason;
    attendanceError = r instanceof Error ? r.message : "Could not load attendance.";
  }

  return { membershipRows, membershipError, attendance, attendanceError };
}

export function MemberMeBootstrapProvider({ children }: { children: React.ReactNode }) {
  const [memberUserId, setMemberUserId] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [membershipRows, setMembershipRows] = useState<MemberActivePlanRow[] | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<MeTodayAttendancePayload | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const runBootstrap = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMemberUserId(null);
      setSkipped(false);
      setPhase("idle");
      setMembershipRows(null);
      setMembershipError(null);
      setAttendance(null);
      setAttendanceError(null);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.is_admin) {
      setMemberUserId(null);
      setSkipped(true);
      setPhase("ready");
      setMembershipRows(null);
      setMembershipError(null);
      setAttendance(null);
      setAttendanceError(null);
      return;
    }

    setSkipped(false);
    setMemberUserId(user.id);
    if (!silent) {
      setPhase("loading");
    }
    setMembershipError(null);
    setAttendanceError(null);

    const r = await fetchMemberBundle(user.id);
    setMembershipRows(r.membershipRows);
    setMembershipError(r.membershipError);
    setAttendance(r.attendance);
    setAttendanceError(r.attendanceError);
    setPhase("ready");
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void runBootstrap();
    });
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      void runBootstrap({ silent: event === "TOKEN_REFRESHED" });
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [runBootstrap]);

  const refetch = useCallback(async () => {
    await runBootstrap({ silent: true });
  }, [runBootstrap]);

  const value = useMemo<MemberMeBootstrapContextValue>(
    () => ({
      ready: phase === "ready",
      loading: phase === "loading",
      skipped,
      memberUserId,
      membershipRows,
      membershipError,
      attendance,
      attendanceError,
      refetch,
    }),
    [phase, skipped, memberUserId, membershipRows, membershipError, attendance, attendanceError, refetch],
  );

  return <MemberMeBootstrapContext.Provider value={value}>{children}</MemberMeBootstrapContext.Provider>;
}

export function useMemberMeBootstrap(): MemberMeBootstrapContextValue {
  const ctx = useContext(MemberMeBootstrapContext);
  if (!ctx) {
    throw new Error("useMemberMeBootstrap must be used inside MemberMeBootstrapProvider");
  }
  return ctx;
}
