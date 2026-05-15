"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Records anonymous and signed-in page views for admin overview stats. */
export default function SiteVisitTracker() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/api")) return;
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    void fetch("/api/site/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        path: pathname,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
      }),
      keepalive: true,
    }).catch(() => {
      /* non-blocking analytics */
    });
  }, [pathname]);

  return null;
}
