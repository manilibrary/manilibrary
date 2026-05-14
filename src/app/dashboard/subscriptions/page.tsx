import PageHeader from "@/components/dashboard/PageHeader";
import StaffSubscriptionsPanel from "@/components/dashboard/StaffSubscriptionsPanel";

export const metadata = { title: "Subscriptions" };

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = sp.focus;
  const focus = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  const initialGroup =
    focus === "expiring"
      ? "expiring"
      : focus === "pending"
        ? "pending"
        : focus === "expired"
          ? "expired"
          : "all";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="subscriptions"
        title="Subscriptions"
        description="Use the status cards for counts, then narrow the table with Show (all, active & expiring, or cancelled) and plan chips."
      />
      <StaffSubscriptionsPanel initialGroup={initialGroup} />
    </div>
  );
}
