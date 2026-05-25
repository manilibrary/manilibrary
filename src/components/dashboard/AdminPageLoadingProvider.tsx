"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import TopLoadingBar from "@/components/ui/TopLoadingBar";

type Ctx = {
  setActive: (on: boolean) => void;
};

const AdminPageLoadingContext = createContext<Ctx | null>(null);

export function AdminPageLoadingProvider({ children }: { children: ReactNode }) {
  const countRef = useRef(0);
  const [active, setActiveState] = useState(false);

  const setActive = useCallback((on: boolean) => {
    countRef.current = Math.max(0, countRef.current + (on ? 1 : -1));
    setActiveState(countRef.current > 0);
  }, []);

  const value = useMemo(() => ({ setActive }), [setActive]);

  return (
    <AdminPageLoadingContext.Provider value={value}>
      <div
        className="-mx-4 h-0.5 shrink-0 overflow-hidden sm:-mx-5 md:-mx-8"
        aria-hidden={!active}
      >
        {active ? <TopLoadingBar /> : null}
      </div>
      <div className="pt-5 sm:pt-6 md:pt-8">{children}</div>
    </AdminPageLoadingContext.Provider>
  );
}

/** Register page-level loading for the top admin progress bar. */
export function useAdminPageLoading(loading: boolean) {
  const ctx = useContext(AdminPageLoadingContext);

  useEffect(() => {
    if (!ctx || !loading) return;
    ctx.setActive(true);
    return () => ctx.setActive(false);
  }, [loading, ctx]);
}
