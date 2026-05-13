/**
 * Staff-only section shell until Supabase / external APIs are wired.
 */
export default function StaffSectionPlaceholder({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-surface-muted/80 p-10 text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
        Coming soon
      </p>
      <h2 className="mt-2 text-lg font-semibold text-ink-900">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
        {body}
      </p>
    </div>
  );
}
