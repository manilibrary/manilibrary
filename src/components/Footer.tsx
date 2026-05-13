import Link from "next/link";
import Logo from "./Logo";
import libraryInfo from "@/data/libraryInfo.json";

const libraryLinks = [
  { href: "/#facilities", label: "Facilities" },
  { href: "/#plans", label: "Plans" },
  { href: "/#about", label: "About" },
  { href: "/#contact", label: "Contact" },
] as const;

export default function Footer() {
  const year = new Date().getFullYear();
  const phoneHref = `tel:${libraryInfo.contact.primaryPhone.replace(/\s/g, "")}`;

  return (
    <footer className="border-t border-ink-100 bg-surface-muted">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-14">
        {/* Mobile: compact stack + side-by-side link columns */}
        <div className="flex flex-col gap-6 md:grid md:grid-cols-4 md:gap-10">
          <div className="md:col-span-2">
            <Logo height={36} />
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-600 md:mt-4 md:line-clamp-none md:max-w-sm md:text-sm">
              {libraryInfo.shortDescription}
            </p>
            <p className="mt-2 font-mono text-[10px] leading-snug text-ink-500 md:mt-3 md:text-xs">
              {libraryInfo.address.line1}, {libraryInfo.address.city}, {libraryInfo.address.state}{" "}
              {libraryInfo.address.pincode}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5 border-t border-ink-100/80 pt-5 md:border-t-0 md:pt-0">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-ink-500">Library</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-ink-700 md:mt-4 md:space-y-2.5 md:text-sm">
                {libraryLinks.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-azure-500">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-ink-500">Members</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-ink-700 md:mt-4 md:space-y-2.5 md:text-sm">
                <li>
                  <Link href="/login" className="hover:text-azure-500">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-azure-500">
                    Admin login
                  </Link>
                </li>
                <li>
                  <a href={phoneHref} className="hover:text-azure-500">
                    {libraryInfo.contact.primaryPhone}
                  </a>
                </li>
                <li className="break-all">
                  <a href={`mailto:${libraryInfo.contact.supportEmail}`} className="hover:text-azure-500">
                    {libraryInfo.contact.supportEmail}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-ink-100 pt-4 text-[11px] text-ink-500 md:mt-10 md:flex-row md:items-center md:justify-between md:gap-3 md:pt-6 md:text-xs">
          <p>
            © {year} {libraryInfo.name}. All rights reserved.
          </p>
          <p className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono">
            <svg
              className="h-3 w-3 shrink-0 text-ink-400 md:h-3.5 md:w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span>Built by</span>
            {libraryInfo.developers.map((d, i) => (
              <span key={d.name}>
                {i > 0 && ", "}
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-azure-500 hover:text-azure-600"
                >
                  {d.creditName ?? d.label}
                </a>
              </span>
            ))}
          </p>
        </div>
      </div>
    </footer>
  );
}
