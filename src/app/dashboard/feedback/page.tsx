import PageHeader from "@/components/dashboard/PageHeader";
import StaffFeedbackPanel from "@/components/dashboard/StaffFeedbackPanel";

export const metadata = { title: "Feedback" };

export default function FeedbackPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="members"
        title="Member feedback"
        description="Review ratings and comments from members. Approved feedback appears in the homepage testimonials section."
      />
      <StaffFeedbackPanel />
    </div>
  );
}
