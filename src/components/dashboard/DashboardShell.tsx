"use client";

import { useCallback, useEffect, useState } from "react";
import { getUxPreferenceCookie, setUxPreferenceCookie } from "@/lib/ux-cookies";
import MemberDashboardRedirect from "./MemberDashboardRedirect";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (getUxPreferenceCookie("dash_sidebar") === "open") {
      setSidebarOpen(true);
    }
  }, []);

  const setDashboardSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpen(open);
    setUxPreferenceCookie("dash_sidebar", open ? "open" : "closed");
  }, []);

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <MemberDashboardRedirect />
      <Sidebar open={sidebarOpen} onClose={() => setDashboardSidebarOpen(false)} />
      {/* min-w-0 is critical: stops flex children from being sized by their
          intrinsic content width, so any wide table inside can scroll
          horizontally instead of expanding the layout off-viewport. */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setDashboardSidebarOpen(true)} />
        <main className="min-w-0 flex-1 px-5 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
