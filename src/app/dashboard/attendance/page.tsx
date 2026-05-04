import PageHeader from "@/components/dashboard/PageHeader";
import AttendanceClient from "./AttendanceClient";

export const metadata = { title: "Attendance" };

export default function AttendancePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="attendance"
        title="Attendance"
        description="Live punch data from the biometric device."
      />
      <AttendanceClient />
    </div>
  );
}
