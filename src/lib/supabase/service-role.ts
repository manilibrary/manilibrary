import { createClient } from "@supabase/supabase-js";

/** Server-only: bypasses RLS. Use only in trusted API routes (e.g. payment verify). */
export function createSupabaseServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Add it to manilibrary/.env.local (same folder as package.json), then restart `npm run dev`.",
    );
  }
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to manilibrary/.env.local, then restart `npm run dev` (env changes are not picked up by a running server).",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
