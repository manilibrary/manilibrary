"use client";

import { useEffect, useState } from "react";

import { formatDateDdMmYyyy } from "@/lib/date-format";
import { CLIENT_DATA_CACHE_TTL_MS, ddcKey, getClientCache, invalidateClientCachePrefix, setClientCache } from "@/lib/client-data-cache";
import { createClient } from "@/lib/supabase/client";

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

type MeActiveCachePayload = {
  signedIn: boolean;
  membership: ActiveMembershipShape | null;
  error: string | null;
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

function cacheKeyForUser(userId: string | undefined): string {
  return userId ? ddcKey.meActive(userId) : ddcKey.meActiveGuest();
}

function readCache(userId: string | undefined): MeActiveCachePayload | null {
  return getClientCache<MeActiveCachePayload>(cacheKeyForUser(userId));
}

function writeCache(userId: string | undefined, payload: MeActiveCachePayload): void {
  setClientCache(cacheKeyForUser(userId), payload, CLIENT_DATA_CACHE_TTL_MS);
}

/**
 * Centralised client hook that asks `/api/memberships/me-active` once per
 * mount. Components reuse the result to swap CTAs ("Reserve a seat" →
 * "View my membership"), display badges, etc.
 *
 * Results are mirrored to sessionStorage (via client-data-cache) for faster
 * reloads and tab returns. Cache is cleared on sign-out.
 */
export function useActiveMembership(): State {
  const [state, setState] = useState<State>(initial);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        const cachedGuest = readCache(undefined);
        const guest: MeActiveCachePayload = { signedIn: false, membership: null, error: null };
        if (cachedGuest) {
          setState({ loading: false, ...cachedGuest });
        } else {
          setState({ loading: false, ...guest });
          writeCache(undefined, guest);
        }
        return;
      }

      const uid = user.id;
      const cached = readCache(uid);
      if (cached) {
        setState({
          loading: false,
          signedIn: cached.signedIn,
          membership: cached.membership,
          error: cached.error,
        });
      }

      try {
        const res = await fetch("/api/memberships/me-active", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          const guest: MeActiveCachePayload = { signedIn: false, membership: null, error: null };
          invalidateClientCachePrefix(ddcKey.meActive(uid));
          writeCache(undefined, guest);
          setState({ loading: false, ...guest });
          return;
        }
        const j = (await res.json()) as {
          ok?: boolean;
          signedIn?: boolean;
          membership?: ActiveMembershipShape | null;
          error?: string;
        };
        if (!res.ok || !j.ok) {
          const next: MeActiveCachePayload = {
            signedIn: j.signedIn ?? false,
            membership: null,
            error: j.error ?? null,
          };
          writeCache(uid, next);
          setState({ loading: false, ...next });
          return;
        }
        const next: MeActiveCachePayload = {
          signedIn: true,
          membership: j.membership ?? null,
          error: null,
        };
        writeCache(uid, next);
        setState({ loading: false, ...next });
      } catch (e) {
        if (cancelled) return;
        const next: MeActiveCachePayload = {
          signedIn: false,
          membership: null,
          error: e instanceof Error ? e.message : "Could not check membership.",
        };
        writeCache(uid, next);
        setState({ loading: false, ...next });
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
