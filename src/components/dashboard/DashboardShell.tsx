"use client";

import { useCallback, useEffect, useState } from "react";
import { getUxPreferenceCookie, setUxPreferenceCookie } from "@/lib/ux-cookies";
import DashboardMobileTabBar from "./DashboardMobileTabBar";
import MemberDashboardRedirect from "./MemberDashboardRedirect";
import { AdminPageLoadingProvider } from "./AdminPageLoadingProvider";
import { MemberMeBootstrapProvider } from "./MemberMeBootstrapProvider";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const LG_MIN = "(min-width: 1024px)";

function readInitialSidebarOpen(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.matchMedia(LG_MIN).matches) return false;
  return getUxPreferenceCookie("dash_sidebar") === "open";
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(readInitialSidebarOpen);

  useEffect(() => {
    const mq = window.matchMedia(LG_MIN);
    const sync = () => {
      if (mq.matches) {
        setSidebarOpen(getUxPreferenceCookie("dash_sidebar") === "open");
      } else {
        setSidebarOpen(false);
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const setDashboardSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpen(open);
    if (typeof window !== "undefined" && window.matchMedia(LG_MIN).matches) {
      setUxPreferenceCookie("dash_sidebar", open ? "open" : "closed");
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted lg:flex-row">
      <MemberDashboardRedirect />
      <Sidebar open={sidebarOpen} onClose={() => setDashboardSidebarOpen(false)} />
      {/* Column stack on small screens (iOS-style content over tab bar); mac-like split from lg */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-h-screen">
        <Topbar onMenu={() => setDashboardSidebarOpen(true)} />
        <main className="min-w-0 flex-1 px-4 sm:px-5 md:px-8 lg:px-8 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:pb-8">
          <MemberMeBootstrapProvider>
            <AdminPageLoadingProvider>{children}</AdminPageLoadingProvider>
          </MemberMeBootstrapProvider>
        </main>
      </div>
      <DashboardMobileTabBar />
    </div>
  );
}
