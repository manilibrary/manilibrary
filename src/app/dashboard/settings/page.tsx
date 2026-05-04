import PageHeader from "@/components/dashboard/PageHeader";
import libraryInfo from "@/data/libraryInfo.json";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="settings"
        title="Library settings"
        description="Manage details that appear across the website and dashboard."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Library">
          <Field label="Name" value={libraryInfo.name} />
          <Field label="Established" value={String(libraryInfo.established)} />
          <Field label="Capacity" value={`${libraryInfo.capacity} seats`} />
          <Field label="Hours" value={libraryInfo.hours} />
        </Card>

        <Card title="Owner">
          <Field label="Name" value={libraryInfo.owner.name} />
          <Field label="Role" value={libraryInfo.owner.role} />
          <Field label="Phone" value={libraryInfo.owner.phone} />
          <Field label="Email" value={libraryInfo.owner.email} />
        </Card>

        <Card title="Address">
          <Field label="Line 1" value={libraryInfo.address.line1} />
          <Field label="City" value={libraryInfo.address.city} />
          <Field label="State" value={libraryInfo.address.state} />
          <Field label="Pincode" value={libraryInfo.address.pincode} />
        </Card>

        <Card title="Contact" wide>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Primary phone"
              value={libraryInfo.contact.primaryPhone}
            />
            <Field
              label="Support email"
              value={libraryInfo.contact.supportEmail}
            />
            <Field label="Website" value={libraryInfo.contact.website} />
            <Field
              label="WhatsApp"
              value={libraryInfo.social.whatsapp}
            />
          </div>
        </Card>

        <Card title="Developers" wide>
          <ul className="space-y-3">
            {libraryInfo.developers.map((d) => (
              <li
                key={d.name}
                className="flex flex-col rounded-xl border border-ink-100 bg-surface-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-ink-900">{d.name}</p>
                  <p className="text-xs text-ink-500">{d.role}</p>
                </div>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-azure-500 hover:text-azure-600 sm:mt-0"
                >
                  {d.label}
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 13 13 7m0 0H8m5 0v5"
                    />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="rounded-xl border border-dashed border-ink-200 bg-surface-muted px-4 py-3 font-mono text-[11px] text-ink-500">
        // values are read from <span className="text-ink-700">src/data/libraryInfo.json</span>.
        Edit that file to update the website and dashboard simultaneously.
      </p>
    </div>
  );
}

function Card({
  title,
  children,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-ink-100 bg-white p-6 shadow-card ${
        wide ? "lg:col-span-3" : ""
      }`}
    >
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      <div className="mt-5 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-ink-50 pb-2.5 last:border-0 last:pb-0">
      <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
        {label}
      </span>
      <span className="text-sm font-medium text-ink-800 break-words">
        {value}
      </span>
    </div>
  );
}
