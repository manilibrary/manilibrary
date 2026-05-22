"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/auth-client-sync";
import type { MemberActivePlanRow } from "@/components/dashboard/MemberActiveMembershipCards";
import { CLIENT_DATA_CACHE_TTL_MS, ddcKey, getClientCache, setClientCache } from "@/lib/client-data-cache";
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
  /** eTime attendance still loading after memberships are ready. */
  attendanceLoading: boolean;
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

async function fetchMembershipRows(userId: string): Promise<{
  membershipRows: MemberActivePlanRow[] | null;
  membershipError: string | null;
}> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("memberships")
      .select("id, plan_kind, status, seat_number, starts_at, ends_at, valid_from, valid_until, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(32);
    if (error) {
      return { membershipRows: [], membershipError: error.message };
    }
    const membershipRows = (data ?? []) as MemberActivePlanRow[];
    setClientCache(ddcKey.memberships(userId), membershipRows, CLIENT_DATA_CACHE_TTL_MS);
    return { membershipRows, membershipError: null };
  } catch (e) {
    return {
      membershipRows: [],
      membershipError: e instanceof Error ? e.message : "Could not load memberships.",
    };
  }
}

async function fetchTodayAttendance(): Promise<{
  attendance: MeTodayAttendancePayload | null;
  attendanceError: string | null;
}> {
  try {
    const res = await fetch("/api/me/today-attendance", { cache: "no-store" });
    const j = (await res.json()) as MeTodayAttendancePayload & { error?: string };
    if (!res.ok || !j.ok) {
      return { attendance: null, attendanceError: j.error ?? "Could not load attendance." };
    }
    return { attendance: j, attendanceError: null };
  } catch (e) {
    return {
      attendance: null,
      attendanceError: e instanceof Error ? e.message : "Could not load attendance.",
    };
  }
}

export function MemberMeBootstrapProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthSession();
  const [memberUserId, setMemberUserId] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [membershipRows, setMembershipRows] = useState<MemberActivePlanRow[] | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendance, setAttendance] = useState<MeTodayAttendancePayload | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const runBootstrap = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;

      if (!auth.ready) return;

      if (!auth.signedIn || !auth.userId) {
        setMemberUserId(null);
        setSkipped(false);
        setPhase("idle");
        setMembershipRows(null);
        setMembershipError(null);
        setAttendanceLoading(false);
        setAttendance(null);
        setAttendanceError(null);
        return;
      }

      if (auth.isAdmin || auth.isSuperAdmin) {
        setMemberUserId(null);
        setSkipped(true);
        setPhase("ready");
        setMembershipRows(null);
        setMembershipError(null);
        setAttendanceLoading(false);
        setAttendance(null);
        setAttendanceError(null);
        return;
      }

      const userId = auth.userId;
      setSkipped(false);
      setMemberUserId(userId);

      const cachedMem = getClientCache<MemberActivePlanRow[]>(ddcKey.memberships(userId));
      setMembershipRows(cachedMem ?? []);
      setMembershipError(null);
      setPhase("ready");

      const memberships = await fetchMembershipRows(userId);
      setMembershipRows(memberships.membershipRows);
      setMembershipError(memberships.membershipError);

      setAttendanceError(null);
      setAttendanceLoading(true);
      const attendanceResult = await fetchTodayAttendance();
      setAttendance(attendanceResult.attendance);
      setAttendanceError(attendanceResult.attendanceError);
      setAttendanceLoading(false);
    },
    [auth.ready, auth.signedIn, auth.userId, auth.isAdmin, auth.isSuperAdmin],
  );

  useEffect(() => {
    void runBootstrap();
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      void runBootstrap({ silent: event === "TOKEN_REFRESHED" });
    });
    const onAuthChanged = () => {
      void runBootstrap();
    };
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
    };
  }, [runBootstrap]);

  const refetch = useCallback(async () => {
    await runBootstrap({ silent: true });
  }, [runBootstrap]);

  const value = useMemo<MemberMeBootstrapContextValue>(
    () => ({
      ready: phase === "ready",
      loading: phase === "loading",
      attendanceLoading,
      skipped,
      memberUserId,
      membershipRows,
      membershipError,
      attendance,
      attendanceError,
      refetch,
    }),
    [phase, attendanceLoading, skipped, memberUserId, membershipRows, membershipError, attendance, attendanceError, refetch],
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
