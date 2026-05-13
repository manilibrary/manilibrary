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
  const initialGroup = focus === "expiring" ? "expiring" : "all";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="subscriptions"
        title="Subscriptions"
        description="Group memberships by status. Click a card to filter the table."
      />
      <StaffSubscriptionsPanel initialGroup={initialGroup} />
    </div>
  );
}
