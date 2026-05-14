import AdminLibraryInsights from "@/components/dashboard/AdminLibraryInsights";
import SuperadminMembershipsPanel from "@/components/dashboard/SuperadminMembershipsPanel";
import SuperadminOpsPanels from "@/components/dashboard/SuperadminOpsPanels";
import SuperadminSafetyBanner from "@/components/dashboard/SuperadminSafetyBanner";
import PageHeader from "@/components/dashboard/PageHeader";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const metadata = { title: "Superadmin" };

export default async function SuperadminPage() {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let allowed = false;
  if (user) {
    try {
      const admin = createSupabaseServiceRoleClient();
      const { data } = await admin.from("profiles").select("is_superadmin").eq("user_id", user.id).maybeSingle();
      allowed = data?.is_superadmin === true;
    } catch {
      allowed = false;
    }
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <p className="font-semibold">Superadmin only</p>
        <p className="mt-2 text-sm">
          Run <span className="font-mono">supabase/add-is-superadmin.sql</span> (or the full bootstrap) so the{" "}
          <span className="font-mono">is_superadmin</span> column exists, then run{" "}
          <span className="font-mono">supabase/set-superadmin.sql</span> with your email to grant access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="superadmin"
        title="Operations"
        description="Look up members and payments, change who is admin, check that payments and the gate link are configured, and edit memberships below."
        actions={
          <span className="inline-flex items-center rounded-full border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-900">
            Superadmin
          </span>
        }
      />
      <AdminLibraryInsights />
      <SuperadminSafetyBanner />
      <SuperadminOpsPanels />
      <section className="space-y-4">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Membership editor</h2>
        <p className="text-sm text-ink-600">
          Edit or permanently remove membership rows and linked payment records. Changes bypass member UI — use carefully.
        </p>
        <SuperadminMembershipsPanel />
      </section>
    </div>
  );
}
