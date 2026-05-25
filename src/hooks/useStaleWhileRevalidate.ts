"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

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
  initialData = null,
}: {
  cacheKey: string;
  fetcher: () => Promise<T>;
  ttlMs?: number;
  /** Bump to force a network refresh (e.g. after a mutation). */
  refreshKey?: number;
  enabled?: boolean;
  /** SSR snapshot — keeps first paint stable and matches hydration. */
  initialData?: T | null;
}) {
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const [data, setData] = useState<T | null>(initialData ?? null);
  const [loading, setLoading] = useState(initialData == null);
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

  useLayoutEffect(() => {
    if (!enabled || initialData != null) return;
    const cached = readCache();
    if (cached == null) return;
    setData(cached);
    setLoading(false);
    setRevalidating(true);
  }, [enabled, initialData, cacheKey, readCache]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const cached = readCache();
    const hasSnapshot = cached != null || initialData != null;

    if (!hasSnapshot) {
      setLoading(true);
      setRevalidating(false);
    } else {
      setRevalidating(true);
    }

    void (async () => {
        try {
          const fresh = await fetcherRef.current();
          if (cancelled) return;
          persist(fresh);
        } catch (e) {
          if (cancelled) return;
          const message = e instanceof Error ? e.message : "Could not load data.";
          if (!hasSnapshot) setError(message);
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
  }, [cacheKey, refreshKey, enabled, initialData, readCache, persist]);

  return { data, loading, revalidating, error, setData: persist };
}
