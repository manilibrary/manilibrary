import PageHeader from "@/components/dashboard/PageHeader";
import StaffPaymentsPanel from "@/components/dashboard/StaffPaymentsPanel";

export const metadata = { title: "Payments" };

export default function PaymentsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="payments"
        title="Payments"
        description="Latest payment rows from Supabase (admin view)."
      />
      <StaffPaymentsPanel />
    </div>
  );
}
