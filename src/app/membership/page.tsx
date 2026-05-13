import Link from "next/link";
import MembershipHubGreeting from "@/components/membership/MembershipHubGreeting";
import libraryInfo from "@/data/libraryInfo.json";

export const metadata = {
  title: "Membership & seats",
};

export default function MembershipHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12 md:px-8 md:py-16">
      <nav className="mb-8 text-sm">
        <Link href="/" className="text-azure-600 hover:text-azure-700">
          ← Home
        </Link>
      </nav>

      <MembershipHubGreeting />

      <p className="font-mono text-[10px] uppercase tracking-widest text-azure-500">
        Membership
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl">
        Choose how you want to sit
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-600">
        Long-term members use the main 100-seat hall layout. Short-term passes
        use the 90-seat row hall. Browse the floor maps to preview where you might sit.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <Link
          href="/membership/long-term"
          className="group flex flex-col rounded-2xl border border-ink-100 bg-white p-8 shadow-card transition hover:border-azure-200 hover:shadow-card-hover"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-azure-600">
            Long-term
          </span>
          <h2 className="mt-2 text-xl font-semibold text-ink-900 group-hover:text-azure-700">
            Main hall · 100 seats
          </h2>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-600">
            Monthly or longer plans. Includes &quot;home desk&quot; concept for
            your regular seat while others show as long-term occupied.
          </p>
          <span className="mt-6 font-mono text-xs font-semibold text-azure-500">
            Open seat map →
          </span>
        </Link>

        <Link
          href="/membership/short-term"
          className="group flex flex-col rounded-2xl border border-ink-100 bg-white p-8 shadow-card transition hover:border-azure-200 hover:shadow-card-hover"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-azure-600">
            Short-term
          </span>
          <h2 className="mt-2 text-xl font-semibold text-ink-900 group-hover:text-azure-700">
            Row hall · 90 seats
          </h2>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-600">
            Day or week style access. Same row numbering as the Expo short-term
            map; blocked and day-pass seats shown as mock data.
          </p>
          <span className="mt-6 font-mono text-xs font-semibold text-azure-500">
            Open seat map →
          </span>
        </Link>
      </div>

      <p className="mt-12 text-center text-xs text-ink-500">
        Already signed in? You can still browse —{" "}
        <Link href="/register" className="text-azure-600 hover:underline">
          Create account
        </Link>{" "}
        or{" "}
        <Link href="/login" className="text-azure-600 hover:underline">
          Sign in
        </Link>{" "}
        from the header. {libraryInfo.name} plans on the home page remain the
        marketing copy until billing is connected.
      </p>
    </div>
  );
}
