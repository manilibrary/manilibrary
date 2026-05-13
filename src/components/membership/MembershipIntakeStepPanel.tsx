"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import ProfileIntakeCard, { type ProfileIntakeInitial } from "@/components/dashboard/ProfileIntakeCard";
import { ProfileIntakePanelSkeleton } from "@/components/ui/ContentSkeletons";
import { CLIENT_DATA_CACHE_TTL_MS, ddcKey, getClientCache, setClientCache } from "@/lib/client-data-cache";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  verification_status: string;
  aadhaar_last_four: string | null;
  student_roll_number: string | null;
  institution_type: string | null;
  preparing_for: string | null;
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
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});
  const [checkoutStagedDocs, setCheckoutStagedDocs] = useState<Record<string, boolean>>({});
  const [checkoutStagingReady, setCheckoutStagingReady] = useState(true);
  const [stagedRefresh, setStagedRefresh] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setSignedIn(false);
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      if (!cancelled) setSignedIn(true);

      const kProf = ddcKey.profileMemberHome(user.id);
      const kDocs = ddcKey.verifDocs(user.id);
      const cProf = getClientCache<ProfileRow>(kProf);
      const cDocs = getClientCache<Record<string, boolean>>(kDocs);
      if (cProf && !cancelled) setProfile(cProf);
      if (cDocs && !cancelled) setUploadedDocs(cDocs);

      const profRes = await supabase
        .from("profiles")
        .select("verification_status, aadhaar_last_four, student_roll_number, institution_type, preparing_for")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      const { data: prof, error: pe } = profRes;
      if (pe) {
        setErr(pe.message);
        setLoading(false);
        return;
      }
      if (prof) {
        setProfile(prof as ProfileRow);
        setClientCache(kProf, prof, CLIENT_DATA_CACHE_TTL_MS);
      }

      const { data: pendReq } = await supabase
        .from("verification_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();

      const docMap: Record<string, boolean> = {};
      if (pendReq?.id) {
        const { data: docs } = await supabase.from("verification_documents").select("doc_type").eq("verification_id", pendReq.id);
        for (const row of docs ?? []) {
          const t = row.doc_type as string | undefined;
          if (t) docMap[t] = true;
        }
      }
      if (!cancelled) {
        setUploadedDocs(docMap);
        setClientCache(kDocs, docMap, CLIENT_DATA_CACHE_TTL_MS);
      }

      if (deferPersist && user) {
        try {
          const r = await fetch("/api/me/verification/document-checkout-pending");
          const j = (await r.json()) as {
            ok?: boolean;
            stagedDocTypes?: string[];
            checkoutKycStagingReady?: boolean;
          };
          if (!cancelled) {
            if (j.ok && Array.isArray(j.stagedDocTypes)) {
              const m: Record<string, boolean> = {};
              for (const t of j.stagedDocTypes) {
                if (t) m[t] = true;
              }
              setCheckoutStagedDocs(m);
              setCheckoutStagingReady(j.checkoutKycStagingReady !== false);
            } else {
              setCheckoutStagedDocs({});
              setCheckoutStagingReady(true);
            }
          }
        } catch {
          if (!cancelled) setCheckoutStagedDocs({});
        }
      } else if (!cancelled) {
        setCheckoutStagedDocs({});
        setCheckoutStagingReady(true);
      }

      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [deferPersist, stagedRefresh]);

  if (loading) {
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
        checkoutStagedDocs={deferPersist ? checkoutStagedDocs : undefined}
        checkoutKycStagingReady={deferPersist ? checkoutStagingReady : true}
        onSaved={onSaved}
        onStagedDocChange={deferPersist ? () => setStagedRefresh((n) => n + 1) : undefined}
        persistMode={deferPersist ? "defer_to_payment" : "immediate"}
      />
    </div>
  );
}
