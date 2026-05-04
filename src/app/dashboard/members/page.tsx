import MembersTable from "./MembersTable";
import PageHeader from "@/components/dashboard/PageHeader";
import { getMembers, getStats } from "@/lib/members";

export const metadata = { title: "Members" };

export default function MembersPage() {
  const members = getMembers();
  const stats = getStats();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="members"
        title="All members"
        description={`${stats.total} total · ${stats.active} active · ${stats.expired} expired`}
        actions={
          <>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:border-ink-300 hover:bg-ink-50"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 14v3h12v-3M10 4v9m0 0-3-3m3 3 3-3"
                />
              </svg>
              Export
            </button>
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 4v12M4 10h12"
                />
              </svg>
              Add member
            </button>
          </>
        }
      />

      <MembersTable members={members} />
    </div>
  );
}
