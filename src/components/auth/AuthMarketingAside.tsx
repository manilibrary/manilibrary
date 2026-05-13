import libraryInfo from "@/data/libraryInfo.json";

/**
 * Right rail for auth screens — matches sign-in marketing layout (split hero).
 */
export default function AuthMarketingAside() {
  return (
    <aside className="relative hidden overflow-hidden bg-ink-900 lg:block">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(800px 400px at 80% 20%, rgba(1,96,208,0.55), transparent 65%), radial-gradient(600px 400px at 20% 80%, rgba(1,96,208,0.35), transparent 60%)",
        }}
      />
      <div className="relative flex h-full flex-col justify-between p-12 text-white">
        <div className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-azure-200">
          <svg
            className="h-3.5 w-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          {libraryInfo.name}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-azure-300">
            Your account
          </p>
          <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            Sign in to access your member area and staff tools as we roll them
            out.
          </h2>
          <ul className="mt-8 space-y-3 text-sm text-ink-200">
            {[
              "Secure sign-in with email",
              "Reset your password anytime",
              "Member home for your library number and details",
              "More library tools will appear here step by step",
            ].map((line) => (
              <li key={line} className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-azure-400" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-azure-200">
            <svg
              className="h-3 w-3 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            At a glance
          </p>
          <div className="mt-3 grid grid-cols-3 gap-4 text-center">
            <Stat label="Seats" value={String(libraryInfo.capacity)} />
            <Stat label="Open" value="24/7" />
            <Stat label="Members" value="500+" />
          </div>
        </div>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-widest text-ink-300">
        {label}
      </p>
    </div>
  );
}
