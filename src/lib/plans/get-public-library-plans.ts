import "server-only";

import {
  LIBRARY_PLANS_SELECT,
  rowToLibraryPlan,
  type LibraryPlan,
  type LibraryPlanRow,
} from "@/lib/plans/library-plans";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export async function getPublicLibraryPlans(): Promise<LibraryPlan[]> {
  try {
    const admin = createSupabaseServiceRoleClient();
    const { data, error } = await admin
      .from("library_plans")
      .select(LIBRARY_PLANS_SELECT)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) return [];
    return (data ?? []).map((r) => rowToLibraryPlan(r as LibraryPlanRow));
  } catch {
    return [];
  }
}
