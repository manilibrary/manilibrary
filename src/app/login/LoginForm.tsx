"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import AuthMarketingAside from "@/components/auth/AuthMarketingAside";
import Logo from "@/components/Logo";
import libraryInfo from "@/data/libraryInfo.json";
import TurnstileWidget from "@/components/security/TurnstileWidget";
import { createClient } from "@/lib/supabase/client";
import { MEMBER_LANDING_PATH, STAFF_LANDING_PATH, sanitizeInternalNext } from "@/lib/auth-landing";
import { clearClientCache } from "@/lib/client-data-cache";
import { FIELD_LIMITS } from "@/lib/security/field-limits";
import { turnstileRequiredOnClient } from "@/lib/security/turnstile-client";
import { clearAllUxPreferenceCookies } from "@/lib/ux-cookies";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `handle_new_user` may lag slightly behind the auth session; retry before failing. */
async function fetchProfileWithRetry(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{
  data: { is_admin: boolean; is_superadmin?: boolean } | null;
  error: { message: string } | null;
}> {
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) await sleep(450);
    const { data, error } = await supabase
      .from("profiles")
      .select("is_admin, is_superadmin")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { data: null, error };
    if (data) return { data, error: null };
  }
  return { data: null, error: null };
}

function staffPortalKeyFromEnv(): string | undefined {
  const v = process.env.NEXT_PUBLIC_STAFF_PORTAL_KEY?.trim();
  return v || undefined;
}

function decodeQueryMessage(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const registered = params.get("registered") === "1";
  const staffPortalKey = staffPortalKeyFromEnv();
  const staffPortalActive = Boolean(
    staffPortalKey && params.get("staff") === staffPortalKey,
  );

  const captchaRequired = turnstileRequiredOnClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const urlMessageError = useMemo(
    () => decodeQueryMessage(params.get("message")),
    [params],
  );
  const displayError = submitError ?? urlMessageError;
  const registerNext = sanitizeInternalNext(params.get("next"));
  const registerHref = registerNext ? `/register?next=${encodeURIComponent(registerNext)}` : "/register";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    if (captchaRequired && !turnstileToken) {
      setSubmitError("Complete the security check below.");
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        setSubmitError(json.error ?? "Sign in failed.");
        setSubmitting(false);
        return;
      }
    } catch {
      setSubmitError("Network error. Try again.");
      setSubmitting(false);
      return;
    }

    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();

    if (sessionError || !user) {
      setSubmitError("Sign-in succeeded but session was not saved. Try again.");
      setSubmitting(false);
      return;
    }

    const { data: profile, error: profileError } = await fetchProfileWithRetry(
      supabase,
      user.id,
    );

    if (profileError) {
      setSubmitError(profileError.message);
      await supabase.auth.signOut();
      clearAllUxPreferenceCookies();
      clearClientCache();
      setSubmitting(false);
      return;
    }

    if (!profile) {
      setSubmitError(
        "We could not find a library member profile for this account. Please contact the library or whoever manages accounts so your login can be linked, then try again.",
      );
      await supabase.auth.signOut();
      clearAllUxPreferenceCookies();
      clearClientCache();
      setSubmitting(false);
      return;
    }

    if (staffPortalActive && !profile.is_admin) {
      setSubmitError(
        "This staff sign-in link is only for admin accounts. Use the regular sign-in page for member access.",
      );
      await supabase.auth.signOut();
      clearAllUxPreferenceCookies();
      clearClientCache();
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    clearClientCache();
    const next = sanitizeInternalNext(params.get("next"));
    const dest =
      profile.is_admin
        ? STAFF_LANDING_PATH
        : profile.is_superadmin
          ? "/dashboard/superadmin"
          : next ?? MEMBER_LANDING_PATH;
    router.replace(dest);
    router.refresh();
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-white px-6 py-8 md:px-12 lg:px-16">
        <header className="flex items-center justify-between">
          <Logo height={36} />
          <Link
            href="/"
            className="text-sm text-ink-500 transition-colors hover:text-azure-500"
          >
            ← Back to site
          </Link>
        </header>

        <div className="mx-auto w-full max-w-md py-10">
          <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-azure-500">
            <svg
              className="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Sign In
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">
            {staffPortalActive ? "Staff sign in" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            {staffPortalActive
              ? "Admin accounts only. After sign-in you will go to the staff dashboard."
              : `Sign in to your ${libraryInfo.name} account with the email and password you used at registration.`}
          </p>

          {registered && (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Account created. You can sign in now
              {params.get("confirm") === "1"
                ? " after you confirm your email (check your inbox)."
                : "."}
            </p>
          )}


          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-ink-500"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={FIELD_LIMITS.emailMax}
                className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block font-mono text-[10px] uppercase tracking-widest text-ink-500"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="text-[10px] font-semibold uppercase tracking-widest text-azure-500 hover:text-azure-600"
                >
                  {showPwd ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id="password"
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={FIELD_LIMITS.passwordMax}
                className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15"
              />
            </div>

            <div className="flex items-center justify-end text-xs">
              <Link
                href="/forgot-password"
                className="font-medium text-azure-500 hover:text-azure-600"
              >
                Forgot password?
              </Link>
            </div>

            <TurnstileWidget onToken={setTurnstileToken} className="mt-2" />

            {displayError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {displayError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-azure-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-azure-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Spinner /> Signing in…
                </>
              ) : (
                <>Sign in</>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-600">
            New to {libraryInfo.name}?{" "}
            <Link href={registerHref} className="font-medium text-azure-500 hover:text-azure-600">
              Create an account
            </Link>
          </p>
          {staffPortalKey && (
            <p className="mt-2 text-center text-sm text-ink-600">
              {staffPortalActive ? (
                <Link
                  href="/login"
                  className="font-medium text-ink-500 underline-offset-2 hover:text-azure-500 hover:underline"
                >
                  Member sign in
                </Link>
              ) : (
                <Link
                  href={`/login?staff=${encodeURIComponent(staffPortalKey)}`}
                  className="font-medium text-ink-500 underline-offset-2 hover:text-azure-500 hover:underline"
                >
                  Staff sign in
                </Link>
              )}
            </p>
          )}
          <p className="mt-2 text-center text-sm text-ink-600">
            <Link
              href="/#plans"
              className="font-medium text-ink-500 underline-offset-2 hover:text-azure-500 hover:underline"
            >
              View membership plans
            </Link>
          </p>
        </div>

        <footer className="flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest text-ink-400">
          <span className="inline-flex items-center gap-1">
            <svg
              className="h-3 w-3 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {libraryInfo.address.city}, {libraryInfo.address.state}
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <svg
              className="h-3 w-3 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {libraryInfo.hours}
          </span>
        </footer>
      </section>

      <AuthMarketingAside />
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
    </svg>
  );
}
