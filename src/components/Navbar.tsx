"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Logo from "./Logo";
import { createClient } from "@/lib/supabase/client";
import { clearClientCache } from "@/lib/client-data-cache";
import { clearAllUxPreferenceCookies, getUxPreferenceCookie, setUxPreferenceCookie } from "@/lib/ux-cookies";
import { MEMBER_ACCOUNT_PATH } from "@/lib/auth-landing";

const links = [
  { href: "#facilities", label: "Facilities" },
  { href: "#about", label: "About" },
  { href: "#plans", label: "Plans" },
  { href: "/membership", label: "Membership" },
  { href: "#contact", label: "Contact" },
];

type AuthBar = {
  ready: boolean;
  signedIn: boolean;
  displayName: string;
  email: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

const initialAuth: AuthBar = {
  ready: false,
  signedIn: false,
  displayName: "",
  email: "",
  isAdmin: false,
  isSuperAdmin: false,
};

function initialsFrom(displayName: string, email: string): string {
  const n = displayName.trim();
  if (n.length >= 2) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [auth, setAuth] = useState<AuthBar>(initialAuth);

  const setSiteNavDrawerOpen = useCallback((next: boolean) => {
    setOpen(next);
    setUxPreferenceCookie("site_nav_drawer", next ? "open" : "closed");
  }, []);

  useEffect(() => {
    if (getUxPreferenceCookie("site_nav_drawer") === "open") {
      setOpen(true);
    }
  }, []);

  const loadAuth = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      setAuth({ ready: true, signedIn: false, displayName: "", email: "", isAdmin: false, isSuperAdmin: false });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, is_admin, is_superadmin")
      .eq("user_id", user.id)
      .maybeSingle();

    const fromMeta =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.trim()
        : "";
    const displayName =
      profile?.full_name?.trim() ||
      fromMeta ||
      user.email.split("@")[0] ||
      "Member";

    setAuth({
      ready: true,
      signedIn: true,
      displayName,
      email: user.email,
      isAdmin: profile?.is_admin === true,
      isSuperAdmin: profile?.is_superadmin === true,
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    void loadAuth();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadAuth();
    });
    return () => subscription.unsubscribe();
  }, [loadAuth]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAllUxPreferenceCookies();
    clearClientCache();
    setUserMenuOpen(false);
    setOpen(false);
    // Full reload so server components (e.g. homepage membership strip) match signed-out session.
    window.location.assign("/");
  };

  const initials = auth.signedIn
    ? initialsFrom(auth.displayName, auth.email)
    : "";

  const roleLabel = auth.isSuperAdmin ? "Superadmin" : auth.isAdmin ? "Admin" : "Member";

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-5 md:px-8">
        <Logo priority height={36} />

        <nav className="hidden flex-1 items-center justify-center gap-8 md:flex">
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

        <div className="flex shrink-0 items-center justify-end gap-2">
          {!auth.ready ? (
            <span className="hidden text-sm text-ink-400 md:inline">…</span>
          ) : auth.signedIn ? (
            <div className="relative">
              {/* Desktop: full pill like dashboard Topbar */}
              <button
                type="button"
                onClick={() => setUserMenuOpen((s) => !s)}
                className="hidden items-center gap-2 rounded-full border border-ink-100 bg-white py-1 pl-1 pr-3 text-sm hover:border-ink-200 md:flex"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-azure-500 font-mono text-xs font-semibold text-white">
                  {initials}
                </span>
                <span className="hidden max-w-[160px] flex-col items-start sm:flex lg:max-w-[220px]">
                  <span className="w-full truncate text-xs font-semibold text-ink-900">
                    {roleLabel}
                  </span>
                  <span className="w-full truncate font-mono text-[10px] text-ink-500">
                    {auth.email}
                  </span>
                </span>
                <svg
                  className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 8 4 4 4-4" />
                </svg>
              </button>

              {/* Mobile: compact pill */}
              <button
                type="button"
                onClick={() => setUserMenuOpen((s) => !s)}
                className="flex items-center gap-1.5 rounded-full border border-ink-100 bg-white py-1 pl-1 pr-2 text-sm hover:border-ink-200 md:hidden"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-azure-500 font-mono text-xs font-semibold text-white">
                  {initials}
                </span>
                <svg
                  className={`h-4 w-4 text-ink-400 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 8 4 4 4-4" />
                </svg>
              </button>

              {userMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 cursor-default bg-transparent"
                    aria-label="Close menu"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div
                    className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card-hover"
                    role="menu"
                  >
                    <div className="border-b border-ink-100 px-4 py-3">
                      <p className="truncate text-xs font-semibold text-ink-900">
                        {auth.displayName}
                      </p>
                      <p className="truncate font-mono text-[10px] text-ink-500">{auth.email}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-azure-600">
                        {roleLabel}
                      </p>
                    </div>
                    {auth.isAdmin ? (
                      <Link
                        href="/dashboard"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink-700 hover:bg-ink-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <svg
                          className="h-4 w-4 text-ink-500"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <rect x="3" y="3" width="7" height="9" rx="1.5" />
                          <rect x="14" y="3" width="7" height="5" rx="1.5" />
                          <rect x="14" y="12" width="7" height="9" rx="1.5" />
                          <rect x="3" y="16" width="7" height="5" rx="1.5" />
                        </svg>
                        Dashboard
                      </Link>
                    ) : (
                      <Link
                        href={MEMBER_ACCOUNT_PATH}
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink-700 hover:bg-ink-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <svg
                          className="h-4 w-4 text-ink-500"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <circle cx="12" cy="8" r="3.5" />
                          <path d="M4 20a8 8 0 0 1 16 0" />
                        </svg>
                        My account
                      </Link>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void signOut()}
                      className="flex w-full items-center gap-2 border-t border-ink-100 px-4 py-2.5 text-left text-sm text-ink-700 hover:bg-ink-50"
                    >
                      <svg
                        className="h-4 w-4 text-ink-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <path d="m16 17 5-5-5-5M21 12H9" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
              >
                Sign in
              </Link>
              <Link
                href="/register"
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
          )}

          <button
            type="button"
            onClick={() => setSiteNavDrawerOpen(!open)}
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
      </div>

      {open && (
        <div className="border-t border-ink-100 bg-white md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setSiteNavDrawerOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 border-t border-ink-100 pt-3">
              {auth.ready && !auth.signedIn ? (
                <div className="flex gap-2">
                  <Link
                    href="/login"
                    onClick={() => setSiteNavDrawerOpen(false)}
                    className="flex-1 rounded-full border border-ink-200 px-4 py-2 text-center text-sm font-medium text-ink-700"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setSiteNavDrawerOpen(false)}
                    className="flex-1 rounded-full bg-azure-500 px-4 py-2 text-center text-sm font-semibold text-white"
                  >
                    Join now
                  </Link>
                </div>
              ) : null}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
