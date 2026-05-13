"use client";

import { useEffect, useState } from "react";

import { formatDateDdMmYyyy } from "@/lib/date-format";

export type ActiveMembershipShape = {
  id: string;
  plan_kind: string;
  status: string;
  seat_number: string | number | null;
  starts_at: string | null;
  ends_at: string | null;
  valid_from: string | null;
  valid_until: string | null;
};

type State = {
  loading: boolean;
  signedIn: boolean;
  membership: ActiveMembershipShape | null;
  error: string | null;
};

const initial: State = {
  loading: true,
  signedIn: false,
  membership: null,
  error: null,
};

/**
 * Centralised client hook that asks `/api/memberships/me-active` once per
 * mount. Components reuse the result to swap CTAs ("Reserve a seat" →
 * "View my membership"), display badges, etc.
 *
 * The fetch is tolerant of every failure mode — network down, 401 unsigned,
 * 5xx server error. In all of those it just returns `signedIn=false` /
 * `membership=null` so the landing page stays usable.
 */
export function useActiveMembership(): State {
  const [state, setState] = useState<State>(initial);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/memberships/me-active", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          setState({ loading: false, signedIn: false, membership: null, error: null });
          return;
        }
        const j = (await res.json()) as {
          ok?: boolean;
          signedIn?: boolean;
          membership?: ActiveMembershipShape | null;
          error?: string;
        };
        if (!res.ok || !j.ok) {
          setState({
            loading: false,
            signedIn: j.signedIn ?? false,
            membership: null,
            error: j.error ?? null,
          });
          return;
        }
        setState({
          loading: false,
          signedIn: true,
          membership: j.membership ?? null,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          signedIn: false,
          membership: null,
          error: e instanceof Error ? e.message : "Could not check membership.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function formatMembershipWindow(m: ActiveMembershipShape): string {
  if (m.plan_kind === "short_term" && m.starts_at && m.ends_at) {
    return `${formatDateDdMmYyyy(m.starts_at)} → ${formatDateDdMmYyyy(m.ends_at)}`;
  }
  if (m.plan_kind === "long_term" && m.valid_from && m.valid_until) {
    return `${formatDateDdMmYyyy(m.valid_from)} → ${formatDateDdMmYyyy(m.valid_until)}`;
  }
  return "—";
}
