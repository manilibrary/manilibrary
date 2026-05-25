"use client";

import AdminLatestPaymentOverview from "@/components/dashboard/AdminLatestPaymentOverview";
import AdminLibraryInsights from "@/components/dashboard/AdminLibraryInsights";
import { AdminOverviewProvider } from "@/components/dashboard/AdminOverviewProvider";

import type { AdminOverviewPayload } from "@/lib/client/fetch-admin-overview";

export default function AdminOverviewSection({
  initialOverview = null,
}: {
  initialOverview?: AdminOverviewPayload | null;
}) {
  return (
    <AdminOverviewProvider initialData={initialOverview}>
      <div className="space-y-6">
        <AdminLibraryInsights />
        <AdminLatestPaymentOverview />
      </div>
    </AdminOverviewProvider>
  );
}
