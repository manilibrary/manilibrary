import Link from "next/link";
import Logo from "./Logo";
import libraryInfo from "@/data/libraryInfo.json";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-ink-100 bg-surface-muted">
      <div className="mx-auto max-w-7xl px-5 py-14 md:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo height={40} />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-600">
              {libraryInfo.shortDescription}
            </p>
            <p className="mt-4 font-mono text-xs text-ink-500">
              {libraryInfo.address.line1}, {libraryInfo.address.city},{" "}
              {libraryInfo.address.state} {libraryInfo.address.pincode}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-500">
              Library
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-700">
              <li>
                <a href="/#facilities" className="hover:text-azure-500">
                  Facilities
                </a>
              </li>
              <li>
                <a href="/#plans" className="hover:text-azure-500">
                  Membership plans
                </a>
              </li>
              <li>
                <a href="/#about" className="hover:text-azure-500">
                  About
                </a>
              </li>
              <li>
                <a href="/#contact" className="hover:text-azure-500">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-500">
              Members
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-700">
              <li>
                <Link href="/login" className="hover:text-azure-500">
                  Sign in
                </Link>
              </li>
              <li>
                <Link
                  href="/login?role=admin"
                  className="hover:text-azure-500"
                >
                  Admin login
                </Link>
              </li>
              <li>
                <a
                  href={`tel:${libraryInfo.contact.primaryPhone.replace(/\s/g, "")}`}
                  className="hover:text-azure-500"
                >
                  {libraryInfo.contact.primaryPhone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${libraryInfo.contact.supportEmail}`}
                  className="hover:text-azure-500"
                >
                  {libraryInfo.contact.supportEmail}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-ink-100 pt-6 text-xs text-ink-500 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {libraryInfo.name}. All rights reserved.
          </p>
          <p className="inline-flex items-center gap-1.5 font-mono text-xs">
            <svg className="h-3.5 w-3.5 shrink-0 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
            Built by{" "}
            {libraryInfo.developers.map((d, i) => (
              <span key={d.name}>
                {i > 0 && ", "}
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-azure-500 hover:text-azure-600"
                >
                  {d.label}
                </a>
              </span>
            ))}
          </p>
        </div>
      </div>
    </footer>
  );
}
