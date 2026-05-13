export default function MembershipDesignBanner() {
  return (
    <div className="rounded-xl border border-dashed border-azure-300 bg-azure-50/70 px-4 py-3 text-sm text-ink-800">
      <span className="font-mono text-[10px] uppercase tracking-widest text-azure-700">
        Design preview
      </span>
      <p className="mt-1 leading-relaxed">
        Seat layouts match the Expo app floor plans. Occupancy is{" "}
        <span className="font-semibold text-ink-900">mock data</span> for now —
        payment and Supabase will plug in next.
      </p>
    </div>
  );
}
