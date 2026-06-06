import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export const MEMBERSHIP_FLOW_ROUTES = ["/membership/plan"] as const;

export function prefetchMembershipRoutes(router: AppRouterInstance): void {
  for (const path of MEMBERSHIP_FLOW_ROUTES) {
    try {
      router.prefetch(path);
    } catch {
      // ignore
    }
  }
}

export function prefetchMembershipPath(router: AppRouterInstance, path: string): void {
  try {
    router.prefetch(path);
  } catch {
    // ignore
  }
}
