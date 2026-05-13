export default function SuperadminSafetyBanner() {
  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
      <p className="font-semibold">Irreversible operations</p>
      <p className="mt-2 text-violet-900/90">
        Deleting memberships or payments cannot be undone from the app. Prefer fixing dates or status in place.
        Keep an offline log (who, when, why) for audits — the app does not write an audit trail yet.
      </p>
    </div>
  );
}
