"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useAdminPageLoading } from "@/components/dashboard/AdminPageLoadingProvider";
import { useStaleWhileRevalidate } from "@/hooks/useStaleWhileRevalidate";
import { fetchAdminOverview, type AdminOverviewPayload } from "@/lib/client/fetch-admin-overview";
import { ddcKey } from "@/lib/client-data-cache";

type OverviewState = ReturnType<typeof useStaleWhileRevalidate<AdminOverviewPayload>>;

const AdminOverviewContext = createContext<OverviewState | null>(null);

export function AdminOverviewProvider({
  children,
  initialData = null,
}: {
  children: ReactNode;
  initialData?: AdminOverviewPayload | null;
}) {
  const value = useStaleWhileRevalidate<AdminOverviewPayload>({
    cacheKey: ddcKey.adminOverview(),
    fetcher: fetchAdminOverview,
    initialData,
  });

  useAdminPageLoading(value.loading || value.revalidating);

  return <AdminOverviewContext.Provider value={value}>{children}</AdminOverviewContext.Provider>;
}

export function useAdminOverview(): OverviewState {
  const ctx = useContext(AdminOverviewContext);
  if (!ctx) {
    throw new Error("useAdminOverview must be used inside AdminOverviewProvider");
  }
  return ctx;
}
