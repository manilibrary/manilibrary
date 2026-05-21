"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useState } from "react";
import Logo from "./Logo";
import { avatarDisplayUrl } from "@/lib/avatars/avatar-display-url";
import { createClient } from "@/lib/supabase/client";
import { clearClientCache } from "@/lib/client-data-cache";
import { MEMBER_ACCOUNT_PATH } from "@/lib/auth-landing";
import { prefetchMembershipRoutes } from "@/lib/membership/prefetch-membership";
import { clearAllUxPreferenceCookies, getUxPreferenceCookie, setUxPreferenceCookie } from "@/lib/ux-cookies";

const links = [
  { href: "/gallery", label: "Gallery", lockDuringCheckout: true },
  { href: "/#facilities", label: "Facilities", lockDuringCheckout: true },
  { href: "/#about", label: "About", lockDuringCheckout: true },
  { href: "/#plans", label: "Plans", lockDuringCheckout: true },
  { href: "/membership", label: "Membership", lockDuringCheckout: false },
  { href: "/#contact", label: "Contact", lockDuringCheckout: true },
] as const;

const CHECKOUT_NAV_HINT = "Finish membership checkout first";

function isMembershipCheckoutPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/membership/long-term" ||
    pathname === "/membership/short-term" ||
    pathname === "/membership/resume-payment"
  );
}

function NavLinkItem({
  href,
  label,
  locked,
  className,
  onNavigate,
  onWarm,
}: {
  href: string;
  label: string;
  locked: boolean;
  className: string;
  onNavigate?: () => void;
  onWarm?: () => void;
}) {
  if (locked) {
    return (
      <span className={className} title={CHECKOUT_NAV_HINT} aria-disabled="true">
        {label}
      </span>
    );
  }
  return (
    <Link href={href} className={className} onClick={onNavigate} onMouseEnter={onWarm} onFocus={onWarm}>
      {label}
    </Link>
  );
}

type AuthBar = {
  ready: boolean;
  signedIn: boolean;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

const initialAuth: AuthBar = {
  ready: false,
  signedIn: false,
  displayName: "",
  email: "",
  avatarUrl: null,
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
  const pathname = usePathname();
  const router = useRouter();
  const checkoutNavLocked = isMembershipCheckoutPath(pathname);

  const warmMembershipNav = useCallback(() => {
    prefetchMembershipRoutes(router);
  }, [router]);

  useEffect(() => {
    if (pathname === "/" || pathname?.startsWith("/membership")) {
      prefetchMembershipRoutes(router);
    }
  }, [pathname, router]);
  const [open, setOpen] = useState(() => getUxPreferenceCookie("site_nav_drawer") === "open");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [auth, setAuth] = useState<AuthBar>(initialAuth);
  const [avatarCacheBust, setAvatarCacheBust] = useState(0);

  const setSiteNavDrawerOpen = useCallback((next: boolean) => {
    setOpen(next);
    setUxPreferenceCookie("site_nav_drawer", next ? "open" : "closed");
  }, []);

  const loadAuth = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      setAuth({
        ready: true,
        signedIn: false,
        displayName: "",
        email: "",
        avatarUrl: null,
        isAdmin: false,
        isSuperAdmin: false,
      });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, is_admin, is_superadmin, avatar_url")
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
      avatarUrl: (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
      isAdmin: profile?.is_admin === true,
      isSuperAdmin: profile?.is_superadmin === true,
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    startTransition(() => {
      void loadAuth();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      startTransition(() => {
        void loadAuth();
      });
    });
    const onAvatarChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ avatarUrl: string | null }>).detail;
      setAvatarCacheBust(Date.now());
      setAuth((a) =>
        a.signedIn ? { ...a, avatarUrl: detail?.avatarUrl ?? a.avatarUrl } : a,
      );
    };
    window.addEventListener("manilibrary:avatar-changed", onAvatarChanged);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("manilibrary:avatar-changed", onAvatarChanged);
    };
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
  const navAvatarSrc = avatarDisplayUrl(auth.avatarUrl, avatarCacheBust || undefined);

  function UserAvatarCircle({ className }: { className?: string }) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-azure-500 font-mono text-xs font-semibold text-white ${className ?? "h-8 w-8"}`}
      >
        {navAvatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={navAvatarSrc}
            alt=""
            width={32}
            height={32}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          initials
        )}
      </span>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-5 md:px-8">
        <Logo priority height={36} href={checkoutNavLocked ? "/membership" : "/"} />

        <nav className="hidden flex-1 items-center justify-center gap-8 md:flex" aria-label="Main">
          {links.map((l) => (
            <NavLinkItem
              key={l.href}
              href={l.href}
              label={l.label}
              locked={checkoutNavLocked && l.lockDuringCheckout}
              onWarm={l.href === "/membership" ? warmMembershipNav : undefined}
              className={
                checkoutNavLocked && l.lockDuringCheckout
                  ? "cursor-not-allowed text-sm font-medium text-ink-400"
                  : "text-sm font-medium text-ink-600 transition-colors hover:text-azure-500"
              }
            />
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
                <UserAvatarCircle />
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
                <UserAvatarCircle />
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
              <NavLinkItem
                key={l.href}
                href={l.href}
                label={l.label}
                locked={checkoutNavLocked && l.lockDuringCheckout}
                onWarm={l.href === "/membership" ? warmMembershipNav : undefined}
                className={
                  checkoutNavLocked && l.lockDuringCheckout
                    ? "cursor-not-allowed rounded-lg px-3 py-2 text-sm font-medium text-ink-400"
                    : "rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
                }
                onNavigate={() => setSiteNavDrawerOpen(false)}
              />
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
