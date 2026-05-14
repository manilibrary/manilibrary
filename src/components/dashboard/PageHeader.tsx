export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-ink-100 pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-azure-600">{eyebrow}</p>
        )}
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900 md:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-ink-600">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
