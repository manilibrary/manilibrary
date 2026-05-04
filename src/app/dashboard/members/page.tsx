import PageHeader from "@/components/dashboard/PageHeader";
import MembersClient from "./MembersClient";

export const metadata = { title: "Members" };

export default function MembersPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="members"
        title="All members"
        description="Employees registered in the biometric device."
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-azure-500 px-4 py-2 text-sm font-semibold text-white hover:bg-azure-600"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 4v12M4 10h12" />
            </svg>
            Add member
          </button>
        }
      />
      <MembersClient />
    </div>
  );
}
