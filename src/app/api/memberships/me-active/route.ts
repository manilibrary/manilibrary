import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { DEFAULT_LIBRARY_TZ, todayYmdInTz } from "@/lib/membership/windows";

export const runtime = "nodejs";

type MembershipRow = {
  id: string;
  plan_kind: string;
  status: string;
  seat_number: string | number | null;
  starts_at: string | null;
  ends_at: string | null;
  valid_from: string | null;
  valid_until: string | null;
};

function asJoinedMembership(
  m: MembershipRow | MembershipRow[] | null | undefined,
): MembershipRow | null {
  if (m == null) return null;
  if (Array.isArray(m)) return m[0] ?? null;
  return m;
}

function membershipEndMs(row: {
  plan_kind: string;
  ends_at?: string | null;
  valid_until?: string | null;
}): number | null {
  if (row.plan_kind === "short_term" && row.ends_at) {
    const t = Date.parse(row.ends_at);
    return Number.isFinite(t) ? t : null;
  }
  if (row.plan_kind === "long_term" && row.valid_until) {
    const t = Date.parse(`${row.valid_until}T23:59:59.999Z`);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

export async function GET(request: Request) {
  const {
    data: { user },
  } = await getAuthUserForApiRequest(request);
  if (!user) {
    return apiError("Sign in required.", 401, { signedIn: false });
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not load membership.");
  }

  const now = new Date();
  const today = todayYmdInTz(DEFAULT_LIBRARY_TZ);
  const nowIso = now.toISOString();

  const membershipSelect =
    "id, plan_kind, status, seat_number, starts_at, ends_at, valid_from, valid_until";

  const { data: current, error } = await admin
    .from("memberships")
    .select(membershipSelect)
    .eq("user_id", user.id)
    .eq("status", "active")
    .or(
      `and(plan_kind.eq.long_term,valid_until.gte.${today}),and(plan_kind.eq.short_term,ends_at.gte.${nowIso})`,
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    return apiErrorSafe(error, 500);
  }

  let data = current;

  /** Paid memberships that start in the future (e.g. bought today for a May 30 start). */
  if (!data) {
    const { data: upcoming, error: upErr } = await admin
      .from("memberships")
      .select(membershipSelect)
      .eq("user_id", user.id)
      .eq("status", "active")
      .or(
        `and(plan_kind.eq.long_term,valid_from.gt.${today}),and(plan_kind.eq.short_term,starts_at.gt.${nowIso})`,
      )
      .order("valid_from", { ascending: true })
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (upErr && upErr.code !== "PGRST116") {
      return apiErrorSafe(upErr, 500);
    }
    data = upcoming;
  }

  /** Payment captured but membership still pending (verify interrupted on mobile). */
  if (!data) {
    const { data: paidRows, error: paidErr } = await admin
      .from("payments")
      .select(
        `id, status, membership_id, memberships!payments_membership_id_fkey (${membershipSelect})`,
      )
      .eq("user_id", user.id)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(3);
    if (paidErr && paidErr.code !== "PGRST116") {
      return apiErrorSafe(paidErr, 500);
    }
    for (const row of paidRows ?? []) {
      const mem = asJoinedMembership(row.memberships as MembershipRow | MembershipRow[] | null);
      if (mem && (mem.status === "active" || mem.status === "pending_payment")) {
        data = mem;
        break;
      }
    }
  }

  let deviceUserId: number | null = null;
  const { data: prof, error: pe } = await admin
    .from("profiles")
    .select("device_user_id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (pe && pe.code !== "PGRST116") {
    return apiErrorSafe(pe, 500);
  }
  const raw = prof?.device_user_id;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    deviceUserId = Math.trunc(raw);
  } else if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const n = Number(raw.trim());
    if (Number.isFinite(n)) deviceUserId = Math.trunc(n);
  }

  const RENEW_WITHIN_DAYS = 3;

  let renewPlanEligible = false;
  if (data) {
    const endMs = membershipEndMs(data);
    if (endMs != null) {
      const daysLeft = Math.max(0, Math.ceil((endMs - now.getTime()) / 86_400_000));
      renewPlanEligible = daysLeft <= RENEW_WITHIN_DAYS;
    }
  } else {
    const { data: lastRow, error: lastErr } = await admin
      .from("memberships")
      .select("status")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastErr && lastRow?.status === "cancelled") {
      renewPlanEligible = true;
    }
  }

  const has = data != null;
  return apiSuccess(
    has ? "Active membership found for your account." : "Signed in; no active membership in the current window.",
    {
      signedIn: true,
      membership: data ?? null,
      device_user_id: deviceUserId,
      renew_plan_eligible: renewPlanEligible,
    },
  );
}
