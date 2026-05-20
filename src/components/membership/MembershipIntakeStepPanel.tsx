"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import ProfileIntakeCard, { type ProfileIntakeInitial } from "@/components/dashboard/ProfileIntakeCard";
import { ProfileIntakePanelSkeleton } from "@/components/ui/ContentSkeletons";
import { parseFetchJson } from "@/lib/api/parse-fetch-json";
import { CLIENT_DATA_CACHE_TTL_MS, ddcKey, getClientCache, setClientCache } from "@/lib/client-data-cache";
import { extrasToDisplayFields } from "@/lib/profiles/profile-extras";
import { createClient } from "@/lib/supabase/client";
import { loadMemberKycForDashboard } from "@/lib/members/member-kyc-client-load";
import type { KycDocType, MemberKycSlotSummary } from "@/lib/verification/verification-repo";

type ProfileRow = {
  verification_status: string;
  aadhaar_last_four: string | null;
  student_roll_number: string | null;
  institution_type: string | null;
  preparing_for: string | null;
};

type CheckoutStagedCache = {
  docs: Record<string, boolean>;
  ready: boolean;
};

type DocumentCheckoutPendingJson = {
  ok?: boolean;
  stagedDocTypes?: string[];
  checkoutKycStagingReady?: boolean;
};

export default function MembershipIntakeStepPanel({
  onSaved,
  deferPersist = false,
}: {
  onSaved?: () => void;
  /** When true (membership checkout), profile fields are not PATCHed until payment succeeds. */
  deferPersist?: boolean;
}) {
  const pathname = usePathname() ?? "/membership";
  const nextParam = encodeURIComponent(pathname);
  const [initialLoading, setInitialLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});
  const [memberKycSlots, setMemberKycSlots] = useState<
    Record<KycDocType, MemberKycSlotSummary> | null
  >(null);
  const [checkoutStagedDocs, setCheckoutStagedDocs] = useState<Record<string, boolean>>({});
  const [checkoutStagingReady, setCheckoutStagingReady] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  const refreshCheckoutStagedDocs = useCallback(async (userId?: string) => {
    try {
      const r = await fetch("/api/me/verification/document-checkout-pending");
      const j = (await parseFetchJson(r)) as DocumentCheckoutPendingJson;
      if (j.ok && Array.isArray(j.stagedDocTypes)) {
        const m: Record<string, boolean> = {};
        for (const t of j.stagedDocTypes) {
          if (t) m[t] = true;
        }
        const ready = j.checkoutKycStagingReady !== false;
        setCheckoutStagedDocs(m);
        setCheckoutStagingReady(ready);
        if (userId) {
          setClientCache(
            ddcKey.checkoutStagedDocs(userId),
            { docs: m, ready } satisfies CheckoutStagedCache,
            CLIENT_DATA_CACHE_TTL_MS,
          );
        }
      } else {
        setCheckoutStagedDocs({});
        setCheckoutStagingReady(true);
      }
    } catch {
      setCheckoutStagedDocs({});
    }
  }, []);

  const onStagedDocChange = useCallback(
    (docType: "aadhaar_front" | "aadhaar_back" | "student_id") => {
      setCheckoutStagedDocs((prev) => ({ ...prev, [docType]: true }));
      void refreshCheckoutStagedDocs(userIdRef.current ?? undefined);
    },
    [refreshCheckoutStagedDocs],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setSignedIn(false);
          setProfile(null);
          setInitialLoading(false);
        }
        return;
      }
      if (!cancelled) setSignedIn(true);
      userIdRef.current = user.id;

      const kProf = ddcKey.profileMemberHome(user.id);
      const kDocs = ddcKey.verifDocs(user.id);
      const kMyc = ddcKey.verifMemberKyc(user.id);
      const kStaged = ddcKey.checkoutStagedDocs(user.id);
      const cProf = getClientCache<ProfileRow>(kProf);
      const cMyc = getClientCache<{ uploadedDocs: Record<string, boolean>; memberKycSlots: Record<KycDocType, MemberKycSlotSummary> }>(
        kMyc,
      );
      const cDocs = getClientCache<Record<string, boolean>>(kDocs);
      const cStaged = getClientCache<CheckoutStagedCache>(kStaged);
      if (cProf && !cancelled) {
        setProfile(cProf);
      }
      if ((cProf || cMyc) && !cancelled) {
        setInitialLoading(false);
      }
      if (!cancelled) {
        if (cMyc) {
          setUploadedDocs(cMyc.uploadedDocs);
          setMemberKycSlots(cMyc.memberKycSlots);
        } else if (cDocs) {
          setUploadedDocs(cDocs);
        }
      }
      if (deferPersist && cStaged && !cancelled) {
        setCheckoutStagedDocs(cStaged.docs);
        setCheckoutStagingReady(cStaged.ready);
      }

      const profPromise = supabase
        .from("profiles")
        .select("is_verified, profile_extras")
        .eq("user_id", user.id)
        .maybeSingle();

      const stagedPromise =
        deferPersist && user ? refreshCheckoutStagedDocs(user.id) : Promise.resolve();

      const { data: prof, error: pe } = await profPromise;

      if (cancelled) return;
      if (pe) {
        setErr(pe.message);
        setInitialLoading(false);
        return;
      }
      if (prof) {
        const x = extrasToDisplayFields((prof as { profile_extras?: unknown }).profile_extras);
        const isVerified = (prof as { is_verified?: boolean }).is_verified === true;
        const kyc = await loadMemberKycForDashboard(supabase, user.id, isVerified);
        if (cancelled) return;
        const mapped: ProfileRow = {
          verification_status: kyc.verificationUiStatus,
          aadhaar_last_four: x.aadhaar_last_four,
          student_roll_number: x.student_roll_number,
          institution_type: x.institution_type,
          preparing_for: x.preparing_for,
        };
        setProfile(mapped);
        setClientCache(kProf, mapped, CLIENT_DATA_CACHE_TTL_MS);
        setUploadedDocs(kyc.uploadedDocs);
        setMemberKycSlots(kyc.memberKycSlots);
        setClientCache(kDocs, kyc.uploadedDocs, CLIENT_DATA_CACHE_TTL_MS);
        setClientCache(
          kMyc,
          { uploadedDocs: kyc.uploadedDocs, memberKycSlots: kyc.memberKycSlots },
          CLIENT_DATA_CACHE_TTL_MS,
        );
      } else if (!deferPersist) {
        setCheckoutStagedDocs({});
        setCheckoutStagingReady(true);
      }

      await stagedPromise;

      if (!cancelled) {
        setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deferPersist, refreshCheckoutStagedDocs]);

  if (initialLoading) {
    return <ProfileIntakePanelSkeleton />;
  }

  if (err) {
    return (
      <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
        {err}
      </p>
    );
  }

  if (!signedIn || !profile) {
    return (
      <div className="rounded-2xl border border-ink-100 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-base font-semibold text-ink-900">Sign in for this step</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Add your details and ID photos here after you sign in. You can use the same account on the next screen for
          payment.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/login?next=${nextParam}`}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-azure-500 px-6 text-sm font-semibold text-white hover:bg-azure-600"
          >
            Sign in
          </Link>
          <Link
            href={`/register?next=${nextParam}`}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink-200 bg-white px-6 text-sm font-semibold text-ink-800 hover:bg-ink-50"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const initial: ProfileIntakeInitial = {
    aadhaar_last_four: profile.aadhaar_last_four,
    student_roll_number: profile.student_roll_number,
    institution_type: profile.institution_type,
    preparing_for: profile.preparing_for,
    verification_status: profile.verification_status ?? "none",
  };

  return (
    <div className="min-w-0">
      <ProfileIntakeCard
        initial={initial}
        uploadedDocs={uploadedDocs}
        memberKycSlots={memberKycSlots ?? undefined}
        checkoutStagedDocs={deferPersist ? checkoutStagedDocs : undefined}
        checkoutKycStagingReady={deferPersist ? checkoutStagingReady : true}
        onSaved={onSaved}
        onStagedDocChange={deferPersist ? onStagedDocChange : undefined}
        persistMode={deferPersist ? "defer_to_payment" : "immediate"}
      />
    </div>
  );
}
