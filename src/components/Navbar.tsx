"use client";

import Link from "next/link";
import { useState } from "react";
import Logo from "./Logo";

const links = [
  { href: "#facilities", label: "Facilities" },
  { href: "#about", label: "About" },
  { href: "#plans", label: "Plans" },
  { href: "#contact", label: "Contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
        <Logo priority height={36} />

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-ink-600 transition-colors hover:text-azure-500"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
          >
            Sign in
          </Link>
          <Link
            href="/login?role=member"
            className="inline-flex items-center gap-1.5 rounded-full bg-azure-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-azure-600"
          >
            Join now
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 10h10m0 0-4-4m4 4-4 4"
              />
            </svg>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-700 hover:bg-ink-50 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-ink-100 bg-white md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2 border-t border-ink-100 pt-3">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-ink-200 px-4 py-2 text-center text-sm font-medium text-ink-700"
              >
                Sign in
              </Link>
              <Link
                href="/login?role=member"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full bg-azure-500 px-4 py-2 text-center text-sm font-semibold text-white"
              >
                Join now
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
