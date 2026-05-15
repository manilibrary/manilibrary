"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CLIENT_DATA_CACHE_TTL_MS,
  getClientCache,
  setClientCache,
} from "@/lib/client-data-cache";

/**
 * Stale-while-revalidate for non-sensitive API payloads.
 *
 * 1. Render from in-memory cache (fastest)
 * 2. Fall back to session tab mirror (same browser tab, survives soft reload)
 * 3. Refresh silently from the network
 * 4. Write updated payload back to cache
 *
 * Do not use for auth roles, payment status, or secrets — server must authorize.
 */
export function useStaleWhileRevalidate<T>({
  cacheKey,
  fetcher,
  ttlMs = CLIENT_DATA_CACHE_TTL_MS,
  refreshKey = 0,
  enabled = true,
}: {
  cacheKey: string;
  fetcher: () => Promise<T>;
  ttlMs?: number;
  /** Bump to force a network refresh (e.g. after a mutation). */
  refreshKey?: number;
  enabled?: boolean;
}) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Always start empty so SSR and the first client render match (avoids hydration mismatch
  // when session cache exists). Cache is applied in useEffect after mount.
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readCache = useCallback((): T | null => getClientCache<T>(cacheKey), [cacheKey]);

  const persist = useCallback(
    (value: T) => {
      setClientCache(cacheKey, value, ttlMs);
      setData(value);
      setError(null);
    },
    [cacheKey, ttlMs],
  );

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const cached = readCache();

    if (cached != null) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setRevalidating(cached != null);

    void (async () => {
      try {
        const fresh = await fetcherRef.current();
        if (cancelled) return;
        persist(fresh);
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Could not load data.";
        if (cached == null) setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRevalidating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, refreshKey, enabled, readCache, persist]);

  return { data, loading, revalidating, error, setData: persist };
}
