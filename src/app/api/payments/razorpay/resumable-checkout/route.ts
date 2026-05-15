import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { PAYMENT_METADATA_PLANNED_SEAT_KEY, parseNumericSeatFromStoredSeat, resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";
import { buildCheckoutFingerprint, type ResumableCheckoutPayload } from "@/lib/membership/resumable-checkout";
import { DEFAULT_LIBRARY_TZ, toYmdBoundary } from "@/lib/membership/windows";
import {
  resolveLongTermDuration,
  resolveShortTermDuration,
  rupeesToRazorpayPaise,
  type MembershipPlanKind,
} from "@/lib/payments/pricing";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type MembershipJoinRow = {
  id: string;
  plan_kind: string;
  status: string | null;
  notes: string | null;
  starts_at: string | null;
  valid_from: string | null;
};

type PaymentRow = {
  id: string;
  amount_rupees: number;
  currency: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  memberships: MembershipJoinRow | MembershipJoinRow[] | null;
};

function asMembership(m: MembershipJoinRow | MembershipJoinRow[] | null): MembershipJoinRow | null {
  if (m == null) return null;
  if (Array.isArray(m)) return m[0] ?? null;
  return m;
}

function parseDurationKeyFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const m = String(notes).match(/duration:([^\s]+)/);
  return m?.[1]?.trim() || null;
}

function membershipStartYmd(m: MembershipJoinRow): string | null {
  if (m.plan_kind === "short_term") {
    return toYmdBoundary(m.starts_at);
  }
  if (m.plan_kind === "long_term") {
    return toYmdBoundary(m.valid_from);
  }
  return null;
}

function isPlanKind(v: string): v is MembershipPlanKind {
  return v === "short_term" || v === "long_term";
}

export async function GET(request: Request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) {
    return apiError("Razorpay is not configured (set RAZORPAY_KEY_ID).", 503);
  }

  const { searchParams } = new URL(request.url);
  const planFilterRaw = searchParams.get("planKind");
  const planFilter: MembershipPlanKind | null =
    planFilterRaw === "short_term" || planFilterRaw === "long_term" ? planFilterRaw : null;
  if (planFilterRaw != null && planFilter == null) {
    return apiError("Invalid planKind (use short_term, long_term, or omit).", 400);
  }

  const {
    data: { user },
    error: authErr,
  } = await getAuthUserForApiRequest(request);
  if (authErr || !user) {
    return apiError("Sign in required.", 401);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not create Supabase admin client.");
  }

  const { data: rows, error } = await admin
    .from("payments")
    .select(
      `
      id,
      amount_rupees,
      currency,
      metadata,
      created_at,
      memberships!payments_membership_id_fkey (
        id,
        plan_kind,
        status,
        notes,
        starts_at,
        valid_from
      )
    `,
    )
    .eq("user_id", user.id)
    .eq("provider", "razorpay")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    return apiErrorSafe(error, 500);
  }

  const list = (rows ?? []) as PaymentRow[];

  for (const pay of list) {
    const meta = (pay.metadata ?? {}) as Record<string, unknown>;
    const orderId = typeof meta.razorpay_order_id === "string" ? meta.razorpay_order_id.trim() : "";
    if (!orderId) continue;

    const mem = asMembership(pay.memberships);
    if (!mem || !isPlanKind(mem.plan_kind)) continue;
    if (planFilter && mem.plan_kind !== planFilter) continue;

    const st = mem.status ?? "";
    if (st !== "pending_payment" && st !== "cancelled") continue;

    const planned = meta[PAYMENT_METADATA_PLANNED_SEAT_KEY];
    const seatNumber = parseNumericSeatFromStoredSeat(typeof planned === "string" ? planned : null);
    if (seatNumber == null) continue;

    const durationKey = parseDurationKeyFromNotes(mem.notes);
    if (!durationKey) continue;

    if (mem.plan_kind === "short_term") {
      if (!resolveShortTermDuration(durationKey)) continue;
    } else {
      if (!resolveLongTermDuration(durationKey)) continue;
    }

    const membershipStartDate = membershipStartYmd(mem);
    if (!membershipStartDate) continue;

    const amountRupees = Number(pay.amount_rupees);
    if (!Number.isFinite(amountRupees) || amountRupees <= 0) continue;

    const fingerprint = buildCheckoutFingerprint({
      planKind: mem.plan_kind,
      seatNumber,
      membershipStartDate,
      durationKey,
    });

    const publicKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? keyId;
    const currency = (pay.currency && String(pay.currency).trim()) || "INR";

    const payload: ResumableCheckoutPayload = {
      paymentId: pay.id,
      orderId,
      amount: rupeesToRazorpayPaise(amountRupees),
      currency,
      keyId: publicKey,
      fingerprint,
      planKind: mem.plan_kind,
      seatNumber,
      membershipStartDate,
      durationKey,
      amountRupees,
      seatLabel: resolveMemberSeatDisplayLabel({
        plan_kind: mem.plan_kind,
        seat_number: seatNumber,
      }),
    };

    return apiSuccess("Resumable checkout found.", { resume: payload, libraryTz: DEFAULT_LIBRARY_TZ });
  }

  return apiSuccess("No pending Razorpay checkout to resume.", { resume: null, libraryTz: DEFAULT_LIBRARY_TZ });
}
