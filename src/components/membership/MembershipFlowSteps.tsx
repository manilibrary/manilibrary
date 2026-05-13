"use client";

const STEPS = [
  { n: 1, label: "Seat" },
  { n: 2, label: "Details & IDs" },
  { n: 3, label: "Pay" },
] as const;

export default function MembershipFlowSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mb-6 flex w-full list-none gap-1 rounded-2xl border border-ink-100 bg-white p-2 shadow-sm sm:gap-2 sm:p-3" aria-label="Membership steps">
      {STEPS.map((s) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <li
            key={s.n}
            className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-2 text-center sm:min-h-0 sm:px-2 sm:py-2.5 ${
              active ? "bg-azure-500 text-white shadow-sm" : done ? "bg-emerald-50 text-emerald-900" : "bg-ink-50 text-ink-500"
            }`}
          >
            <span className="font-mono text-[9px] uppercase tracking-wider opacity-90 sm:text-[10px]">Step {s.n}</span>
            <span className={`mt-0.5 text-[11px] font-semibold leading-tight sm:text-xs ${active ? "text-white" : ""}`}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
