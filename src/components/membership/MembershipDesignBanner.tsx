export default function MembershipDesignBanner() {
  return (
    <div className="rounded-xl border border-dashed border-azure-300 bg-azure-50/70 px-3 py-2.5 text-xs text-ink-800 sm:text-sm">
      <span className="font-mono text-[10px] uppercase tracking-widest text-azure-700">Design note</span>
      <p className="mt-1 leading-snug">
        Floor layout matches the library app. Live “taken” seats appear after you <strong className="font-medium">sign in</strong>.
      </p>
    </div>
  );
}
