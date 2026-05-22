"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { displayPersonName } from "@/lib/format-person-name";
import { AUTH_SESSION_CHANGED_EVENT, syncBrowserAuthSession } from "@/lib/auth-client-sync";
import { CLIENT_DATA_CACHE_TTL_MS, ddcKey, getClientCache, setClientCache } from "@/lib/client-data-cache";
import { createClient, getBrowserUser } from "@/lib/supabase/client";

export type AuthSessionState = {
  ready: boolean;
  signedIn: boolean;
  userId: string | null;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

const empty: AuthSessionState = {
  ready: false,
  signedIn: false,
  userId: null,
  email: "",
  displayName: "",
  avatarUrl: null,
  isAdmin: false,
  isSuperAdmin: false,
};

export type AuthSessionContextValue = AuthSessionState & {
  refresh: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

/** One browser auth + profile load shared by Navbar, Topbar, etc. */
export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSessionState>(empty);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session: localSession },
    } = await supabase.auth.getSession();
    const sessionUser = localSession?.user;
    if (sessionUser?.email) {
      const navKey = ddcKey.profileNav(sessionUser.id);
      const cached = getClientCache<{
        full_name?: string | null;
        is_admin?: boolean | null;
        is_superadmin?: boolean | null;
        avatar_url?: string | null;
      }>(navKey);
      const fromMeta =
        typeof sessionUser.user_metadata?.full_name === "string"
          ? sessionUser.user_metadata.full_name.trim()
          : "";
      setSession({
        ready: true,
        signedIn: true,
        userId: sessionUser.id,
        email: sessionUser.email,
        displayName:
          cached?.full_name?.trim() ||
          fromMeta ||
          displayPersonName(null, sessionUser.email.split("@")[0] ?? "Member"),
        avatarUrl: cached?.avatar_url ?? null,
        isAdmin: cached?.is_admin === true,
        isSuperAdmin: cached?.is_superadmin === true,
      });
    }

    const user = await getBrowserUser();
    if (!user?.email) {
      setSession({ ...empty, ready: true });
      return;
    }

    const navKey = ddcKey.profileNav(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, is_admin, is_superadmin, avatar_url")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    const fromMeta =
      typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
    const displayName =
      profile?.full_name?.trim() ||
      fromMeta ||
      user.email.split("@")[0] ||
      "Member";

    setClientCache(
      navKey,
      {
        full_name: profile?.full_name ?? null,
        is_admin: profile?.is_admin ?? null,
        is_superadmin: profile?.is_superadmin ?? null,
        avatar_url: profile?.avatar_url ?? null,
      },
      CLIENT_DATA_CACHE_TTL_MS,
    );

    setSession({
      ready: true,
      signedIn: true,
      userId: user.id,
      email: user.email,
      displayName: displayPersonName(displayName, "Member"),
      avatarUrl: profile?.avatar_url ?? null,
      isAdmin: profile?.is_admin === true,
      isSuperAdmin: profile?.is_superadmin === true,
    });
  }, []);

  useEffect(() => {
    void refresh();
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    const onAuthChanged = () => {
      void refresh();
    };
    const onAvatar = (e: Event) => {
      const detail = (e as CustomEvent<{ avatarUrl: string | null }>).detail;
      setSession((s) => (s.signedIn ? { ...s, avatarUrl: detail?.avatarUrl ?? null } : s));
    };
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
    window.addEventListener("manilibrary:avatar-changed", onAvatar);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener("manilibrary:avatar-changed", onAvatar);
    };
  }, [refresh]);

  const value = useMemo<AuthSessionContextValue>(
    () => ({ ...session, refresh }),
    [session, refresh],
  );
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) {
    throw new Error("useAuthSession must be used inside AuthSessionProvider");
  }
  return ctx;
}
