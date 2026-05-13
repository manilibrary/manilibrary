import Link from "next/link";

import AdminAttendanceOverview from "@/components/dashboard/AdminAttendanceOverview";
import AdminLibraryInsights from "@/components/dashboard/AdminLibraryInsights";
import PageHeader from "@/components/dashboard/PageHeader";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const quickLinks = [
  {
    href: "/dashboard/members",
    title: "Members",
    hint: "Roster + active memberships",
  },
  {
    href: "/dashboard/payments",
    title: "Payments",
    hint: "Razorpay charges and pending rows",
  },
  {
    href: "/dashboard/subscriptions",
    title: "Subscriptions",
    hint: "Active / expired / pending plans",
  },
  {
    href: "/dashboard/attendance",
    title: "Attendance",
    hint: "Biometric punches today + history",
  },
  {
    href: "/dashboard/settings",
    title: "Settings",
    hint: "Account and workspace preferences",
  },
] as const;

export const metadata = { title: "Overview" };

export default async function DashboardOverview() {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let isSuperadmin = false;
  if (user) {
    try {
      const admin = createSupabaseServiceRoleClient();
      const { data } = await admin
        .from("profiles")
        .select("is_admin, is_superadmin")
        .eq("user_id", user.id)
        .maybeSingle();
      isAdmin = data?.is_admin === true;
      isSuperadmin = data?.is_superadmin === true;
    } catch {
      isAdmin = false;
      isSuperadmin = false;
    }
  }

  const tiles = [
    ...quickLinks,
    ...(isSuperadmin
      ? ([
          {
            href: "/dashboard/superadmin",
            title: "Superadmin",
            hint: "Search, payments, profile flags, membership editor",
          },
        ] as const)
      : []),
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="dashboard"
        title="Staff home"
        description={
          isAdmin
            ? "Live snapshot of members, payments, attendance, and expiring plans."
            : "Sign in as an admin to see members / payments stats."
        }
      />

      {isAdmin ? <AdminLibraryInsights /> : null}

      {isAdmin ? <AdminAttendanceOverview /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-2xl border border-ink-100 bg-white p-5 shadow-card transition-colors hover:border-azure-200 hover:shadow-card-hover"
          >
            <p className="text-sm font-semibold text-ink-900 group-hover:text-azure-700">{item.title}</p>
            <p className="mt-1 text-xs text-ink-500">{item.hint}</p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-azure-500">Open →</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
