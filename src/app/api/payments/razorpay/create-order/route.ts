import Razorpay from "razorpay";

import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import {
  DEFAULT_LIBRARY_TZ,
  addDaysYmd,
  addWallClockHours,
  isOnOrAfterYmd,
  longTermInclusiveUntil,
  membershipDayStartIso,
  todayYmdInTz,
} from "@/lib/membership/windows";
import {
  LONG_TERM_DURATION_OPTIONS,
  computeOrderAmountRupees,
  resolveLongTermDuration,
  resolveShortTermDuration,
  rupeesToRazorpayPaise,
  SHORT_TERM_DURATION_OPTIONS,
  type MembershipPlanKind,
} from "@/lib/payments/pricing";
import {
  PAYMENT_METADATA_PLANNED_SEAT_KEY,
  PENDING_MEMBERSHIP_SEAT_PLACEHOLDER,
  formatMemberSeatToken,
  resolveMemberSeatDisplayLabel,
} from "@/lib/membership/seat-label";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

export const runtime = "nodejs";

const MAX_ADVANCE_BOOKING_DAYS = 120;

type Body = {
  planKind: MembershipPlanKind;
  seatNumber: number;
  membershipStartDate: string;
  durationKey: string;
};

function isPlanKind(v: unknown): v is MembershipPlanKind {
  return v === "short_term" || v === "long_term";
}

export async function POST(request: Request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return apiError("Razorpay is not configured (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET).", 503);
  }

  const tz = DEFAULT_LIBRARY_TZ;
  const today = todayYmdInTz(tz);

  let body: Body;
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    if (
      !isPlanKind(raw.planKind) ||
      typeof raw.seatNumber !== "number" ||
      !Number.isFinite(raw.seatNumber) ||
      typeof raw.membershipStartDate !== "string" ||
      typeof raw.durationKey !== "string"
    ) {
      return apiError(
        "Invalid body: planKind, seatNumber, membershipStartDate (YYYY-MM-DD), durationKey required.",
        400,
      );
    }
    body = {
      planKind: raw.planKind,
      seatNumber: Math.round(raw.seatNumber),
      membershipStartDate: raw.membershipStartDate.trim(),
      durationKey: raw.durationKey.trim(),
    };
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.membershipStartDate)) {
    return apiError("membershipStartDate must be YYYY-MM-DD.", 400);
  }
  if (!isOnOrAfterYmd(body.membershipStartDate, today)) {
    return apiError(`Membership must start on or after today (${today} in ${tz}).`, 400);
  }
  const maxStart = addDaysYmd(today, MAX_ADVANCE_BOOKING_DAYS);
  if (body.membershipStartDate > maxStart) {
    return apiError(`Start date cannot be more than ${MAX_ADVANCE_BOOKING_DAYS} days ahead.`, 400);
  }

  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError("Sign in required.", 401);
  }

  const amountRupees = computeOrderAmountRupees(body.planKind, body.durationKey);
  if (amountRupees == null || !Number.isFinite(amountRupees) || amountRupees <= 0) {
    return apiError("Invalid plan duration for checkout.", 400);
  }
  const amountPaise = rupeesToRazorpayPaise(amountRupees);
  const now = new Date();

  // Block double-booking: one active membership per user.
  const todayIso = now.toISOString().slice(0, 10);
  const { data: existingActive, error: existingErr } = await supabase
    .from("memberships")
    .select("id, plan_kind, seat_number, valid_until, ends_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .or(
      `and(plan_kind.eq.long_term,valid_until.gte.${todayIso}),and(plan_kind.eq.short_term,ends_at.gte.${now.toISOString()})`,
    )
    .limit(1)
    .maybeSingle();

  if (existingErr && existingErr.code !== "PGRST116") {
    return apiErrorSafe(existingErr, 500);
  }
  if (existingActive) {
    const until =
      existingActive.plan_kind === "long_term"
        ? existingActive.valid_until
        : existingActive.ends_at;
    return apiError(
      `You already have an active ${String(existingActive.plan_kind).replace(/_/g, " ")} membership on seat ${resolveMemberSeatDisplayLabel({
        plan_kind: String(existingActive.plan_kind),
        seat_number: existingActive.seat_number as string | number | null,
      })} (until ${until}). Wait for it to expire, or contact the library to cancel.`,
      409,
    );
  }

  let membership: { id: string } | null = null;
  let memErr: { message: string } | null = null;

  const plannedSeatToken = formatMemberSeatToken(body.planKind, body.seatNumber);

  if (body.planKind === "short_term") {
    const dur = resolveShortTermDuration(body.durationKey);
    if (!dur) {
      return apiError(
        `Invalid durationKey for short-term. Use one of: ${SHORT_TERM_DURATION_OPTIONS.map((o) => o.key).join(", ")}.`,
        400,
      );
    }
    const startsIso = membershipDayStartIso(body.membershipStartDate, tz);
    const endsIso = addWallClockHours(startsIso, dur.durationHours);
    const res = await supabase
      .from("memberships")
      .insert({
        user_id: user.id,
        plan_kind: "short_term",
        status: "pending_payment",
        seat_number: PENDING_MEMBERSHIP_SEAT_PLACEHOLDER,
        starts_at: startsIso,
        ends_at: endsIso,
        notes: `duration:${dur.key}`,
      })
      .select("id")
      .single();
    membership = res.data;
    memErr = res.error;
  } else {
    const dur = resolveLongTermDuration(body.durationKey);
    if (!dur) {
      return apiError(
        `Invalid durationKey for long-term. Use one of: ${LONG_TERM_DURATION_OPTIONS.map((o) => o.key).join(", ")}.`,
        400,
      );
    }
    const validFrom = body.membershipStartDate;
    const validUntil = longTermInclusiveUntil(validFrom, dur.calendarMonths);
    const res = await supabase
      .from("memberships")
      .insert({
        user_id: user.id,
        plan_kind: "long_term",
        status: "pending_payment",
        seat_number: PENDING_MEMBERSHIP_SEAT_PLACEHOLDER,
        valid_from: validFrom,
        valid_until: validUntil,
        notes: `duration:${dur.key}`,
      })
      .select("id")
      .single();
    membership = res.data;
    memErr = res.error;
  }

  if (memErr || !membership) {
    const maybeCode = (memErr as unknown as { code?: string } | null)?.code;
    if (maybeCode === "23P01") {
      return apiError(
        `Seat ${body.seatNumber} is already taken for overlapping dates. Please pick another seat or dates.`,
        409,
      );
    }
    return apiErrorSafe(
      memErr,
      400,
      "Could not create membership. Check your dates and seat, or try again later.",
    );
  }

  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .insert({
      user_id: user.id,
      membership_id: membership.id,
      amount_rupees: amountRupees,
      currency: "INR",
      provider: "razorpay",
      status: "pending",
      metadata: { [PAYMENT_METADATA_PLANNED_SEAT_KEY]: plannedSeatToken },
    })
    .select("id")
    .single();

  if (payErr || !payment) {
    return apiErrorSafe(payErr, 400, "Could not create payment row.");
  }

  const receipt = payment.id.replace(/-/g, "").slice(0, 40);

  let order: { id: string; amount: number; currency: string };
  try {
    const rz = new Razorpay({ key_id: keyId, key_secret: keySecret });
    order = (await rz.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        payment_id: payment.id,
        membership_id: membership.id,
        user_id: user.id,
      },
    })) as { id: string; amount: number; currency: string };
  } catch (e) {
    return apiErrorSafe(e, 502, "Payment provider could not create the order. Try again in a moment.");
  }

  const { error: metaErr } = await supabase
    .from("payments")
    .update({
      metadata: {
        [PAYMENT_METADATA_PLANNED_SEAT_KEY]: plannedSeatToken,
        razorpay_order_id: order.id,
      },
      provider_payment_id: order.id,
    })
    .eq("id", payment.id);

  if (metaErr) {
    return apiError("Order created but failed to save Razorpay order id on payment.", 500, {
      razorpayOrderId: order.id,
      paymentId: payment.id,
    });
  }

  await supabase.from("memberships").update({ payment_id: payment.id }).eq("id", membership.id);

  const publicKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? keyId;

  return apiSuccess("Membership and Razorpay checkout order created. Complete payment in Razorpay UI.", {
    keyId: publicKey,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    paymentId: payment.id,
    membershipId: membership.id,
  });
}
