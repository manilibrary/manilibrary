"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearAllUxPreferenceCookies } from "@/lib/ux-cookies";
import { clearClientCache, CLIENT_DATA_CACHE_TTL_MS, ddcKey, getClientCache, setClientCache } from "@/lib/client-data-cache";

type BarUser = {
  email: string;
  roleLabel: "Superadmin" | "Admin" | "Member";
  initials: string;
};

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname() ?? "";
  const hideMemberSearch = pathname.startsWith("/dashboard/me");
  const [user, setUser] = useState<BarUser | null>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const load = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!authUser?.email) {
        setUser(null);
        setReady(true);
        return;
      }

      const navKey = ddcKey.profileNav(authUser.id);
      const cachedFlags = getClientCache<{ is_admin?: boolean | null; is_superadmin?: boolean | null }>(navKey);
      if (cachedFlags) {
        const roleLabel: BarUser["roleLabel"] =
          cachedFlags.is_superadmin === true
            ? "Superadmin"
            : cachedFlags.is_admin
              ? "Admin"
              : "Member";
        setUser({
          email: authUser.email,
          roleLabel,
          initials: authUser.email.slice(0, 2).toUpperCase(),
        });
        setReady(true);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, is_superadmin")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (cancelled) return;

      setClientCache(
        navKey,
        { is_admin: profile?.is_admin ?? null, is_superadmin: profile?.is_superadmin ?? null },
        CLIENT_DATA_CACHE_TTL_MS,
      );

      const roleLabel: BarUser["roleLabel"] =
        profile?.is_superadmin === true
          ? "Superadmin"
          : profile?.is_admin
            ? "Admin"
            : "Member";

      setUser({
        email: authUser.email,
        roleLabel,
        initials: authUser.email.slice(0, 2).toUpperCase(),
      });
      setReady(true);
    };

    void load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAllUxPreferenceCookies();
    clearClientCache();
    window.location.assign("/login");
  };

  const email = user?.email ?? "";
  const roleLabel = user?.roleLabel ?? "Member";
  const initials =
    user?.initials ?? (ready ? "?" : "·");

  return (
    <header className="sticky top-0 z-20 border-b border-ink-100 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="flex h-16 items-center gap-3 px-5 md:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-700 hover:bg-ink-50 lg:hidden"
          aria-label="Open menu"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        {hideMemberSearch ? (
          <div className="hidden min-w-0 flex-1 md:block" aria-hidden />
        ) : (
          <div className="hidden flex-1 md:block">
            <label className="relative block max-w-md">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <input
                type="search"
                placeholder="Search (coming soon)"
                className="w-full rounded-full border border-ink-200 bg-surface-muted py-2 pl-10 pr-4 text-sm text-ink-800 placeholder-ink-400 outline-none transition focus:border-azure-500 focus:bg-white focus:ring-4 focus:ring-azure-500/15"
              />
            </label>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-600 hover:bg-ink-50"
            aria-label="Notifications"
          >
            <svg
              className="h-[18px] w-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-azure-500 ring-2 ring-white" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((s) => !s)}
              className="flex items-center gap-2 rounded-full border border-ink-100 bg-white py-1 pl-1 pr-3 text-sm hover:border-ink-200"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-azure-500 font-mono text-xs font-semibold text-white">
                {initials}
              </span>
              <span className="hidden flex-col items-start sm:flex">
                <span className="text-xs font-semibold text-ink-900">
                  {ready ? roleLabel : "Loading…"}
                </span>
                <span className="font-mono text-[10px] text-ink-500">
                  {ready ? (email || "—") : "—"}
                </span>
              </span>
              <svg
                className="h-4 w-4 text-ink-400"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 8 4 4 4-4" />
              </svg>
            </button>

            {menuOpen && (
              <>
                <button
                  className="fixed inset-0 z-10 cursor-default"
                  aria-hidden
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card-hover">
                  <div className="border-b border-ink-100 px-4 py-3">
                    <p className="text-xs font-semibold text-ink-900">
                      {ready ? roleLabel : "Loading…"}
                    </p>
                    <p className="font-mono text-[10px] text-ink-500">
                      {ready ? (email || "—") : "—"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      void signOut();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink-700 hover:bg-ink-50"
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
        </div>
      </div>
    </header>
  );
}
