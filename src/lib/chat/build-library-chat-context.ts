import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import libraryInfo from "@/data/libraryInfo.json";
import { planDisplayName } from "@/lib/plans/library-plans";
import {
  LIBRARY_PLANS_SELECT,
  rowToLibraryPlan,
  type LibraryPlanRow,
} from "@/lib/plans/library-plans";
import { buildStudentMemberProfileBody } from "@/lib/members/student-member-profile-envelope";
import {
  getMemberReferralSummary,
  getRefereePendingReferral,
  loadReferralSettings,
} from "@/lib/referrals/library-referrals";
import { DEFAULT_LIBRARY_TZ, todayYmdInTz } from "@/lib/membership/windows";
import { planSeatCapacity } from "@/lib/membership/plan-seat-capacity";
import { occupiedSeatsForPlanCode } from "@/lib/membership/plan-seat-occupancy";
import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";

export type ChatAudience = "public" | "member";

export type LibraryChatContext = {
  audience: ChatAudience;
  library: Record<string, unknown>;
  plans: unknown[];
  seatAvailability?: {
    asOfDate: string;
    note: string;
    byPlan: Array<{
      planCode: string;
      planName: string;
      floor: number;
      totalSeats: number;
      occupiedSeats: number;
      availableSeats: number;
    }>;
  };
  referralsProgram?: Record<string, unknown>;
  member?: Record<string, unknown>;
};

function publicLibraryInfo(): Record<string, unknown> {
  const {
    demoCredentials: _demo,
    developers: _devs,
    ...rest
  } = libraryInfo as Record<string, unknown> & {
    demoCredentials?: unknown;
    developers?: unknown;
  };
  return rest;
}

function publicPlanSummary(rows: LibraryPlanRow[]) {
  return rows.map((r) => {
    const plan = rowToLibraryPlan(r);
    return {
      code: plan.code,
      name: plan.name,
      floor: plan.floor,
      accessLabel: plan.accessLabel,
      is24Hour: plan.is24Hour,
      durations: plan.durations.map((d) => ({
        label: d.label,
        priceInr: d.price,
        mrpInr: d.mrp,
        discountPercent: d.discountPercent,
      })),
    };
  });
}

async function loadSeatAvailability(admin: SupabaseClient, planRows: LibraryPlanRow[]) {
  const asOfDate = todayYmdInTz(DEFAULT_LIBRARY_TZ);
  const byPlan = await Promise.all(
    planRows.map(async (row) => {
      const plan = rowToLibraryPlan(row);
      const totalSeats = planSeatCapacity(plan.code) ?? 0;
      const occupiedSeats = (await occupiedSeatsForPlanCode(admin, plan.code, asOfDate)).length;
      const availableSeats = Math.max(0, totalSeats - occupiedSeats);
      return {
        planCode: plan.code,
        planName: plan.name,
        floor: plan.floor,
        totalSeats,
        occupiedSeats,
        availableSeats,
      };
    }),
  );

  return {
    asOfDate,
    note:
      "Counts are for active memberships covering this date. Floor-2 shift plans (morning/evening/night) share the same desks; each shift is counted separately.",
    byPlan,
  };
}

async function loadActivePlans(admin: SupabaseClient) {
  const { data } = await admin
    .from("library_plans")
    .select(LIBRARY_PLANS_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as LibraryPlanRow[];
}

async function loadMemberMembership(admin: SupabaseClient, userId: string) {
  const today = todayYmdInTz(DEFAULT_LIBRARY_TZ);
  const nowIso = new Date().toISOString();

  const { data } = await admin
    .from("memberships")
    .select(
      "id, plan_kind, plan_code, shift, status, seat_number, starts_at, ends_at, valid_from, valid_until",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .or(`valid_until.gte.${today},ends_at.gte.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    plan: planDisplayName(data.plan_code, data.plan_kind),
    planCode: data.plan_code,
    planKind: data.plan_kind,
    shift: data.shift,
    status: data.status,
    seat: resolveMemberSeatDisplayLabel({
      plan_kind: data.plan_kind,
      seat_number: data.seat_number,
    }),
    validFrom: data.valid_from,
    validUntil: data.valid_until,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
  };
}

export async function buildLibraryChatContext(
  admin: SupabaseClient,
  user: User | null,
): Promise<LibraryChatContext> {
  const planRows = await loadActivePlans(admin);
  const [referralSettings, seatAvailability] = await Promise.all([
    loadReferralSettings(admin),
    loadSeatAvailability(admin, planRows),
  ]);

  const referralsProgram = {
    enabled: referralSettings.enabled,
    creditsPerSuccessfulReferralInr: referralSettings.creditsPerReferral,
    maxReferralsPerMember: referralSettings.maxPerMember,
    refereeGetsCredits: false,
    referrerEarnsOnRefereeFirstPayment: true,
    signupField: "optional referral code at registration",
    checkoutNote: "Referee can keep or remove signup referral at payment; cannot combine with coupons",
  };

  if (!user) {
    return {
      audience: "public",
      library: publicLibraryInfo(),
      plans: publicPlanSummary(planRows),
      seatAvailability,
      referralsProgram,
    };
  }

  const profile = await buildStudentMemberProfileBody(admin, user);
  if (!profile.ok) {
    return {
      audience: "public",
      library: publicLibraryInfo(),
      plans: publicPlanSummary(planRows),
      seatAvailability,
      referralsProgram,
    };
  }

  const body = profile.body;
  const isStaff = body.role === "admin";
  const [membership, referralSummary, signupReferral] = await Promise.all([
    loadMemberMembership(admin, user.id),
    isStaff ? Promise.resolve(null) : getMemberReferralSummary(admin, user.id),
    isStaff ? Promise.resolve(null) : getRefereePendingReferral(admin, user.id),
  ]);

  return {
    audience: "member",
    library: publicLibraryInfo(),
    plans: publicPlanSummary(planRows),
    seatAvailability,
    referralsProgram,
    member: {
      role: body.role,
      name: body.name,
      email: body.email,
      phone: body.phone,
      libraryNumber: body.libraryNumber,
      verificationStatus: body.verificationStatus,
      avatarUrl: body.avatarUrl,
      membership,
      referral: referralSummary
        ? {
            yourCode: referralSummary.referralCode,
            creditBalanceInr: referralSummary.creditBalance,
            referralsUsed: referralSummary.referralsUsed,
            referralsMax: referralSummary.referralsMax,
            creditsPerReferralInr: referralSummary.creditsPerReferral,
            shareSignupUrl: referralSummary.signupUrl,
          }
        : null,
      signupReferralUsed: signupReferral
        ? { code: signupReferral.code, status: "pending_first_payment" }
        : null,
      kycSlots: body.memberKycSlots,
    },
  };
}
