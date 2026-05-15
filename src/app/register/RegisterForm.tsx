"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import AuthMarketingAside from "@/components/auth/AuthMarketingAside";
import Logo from "@/components/Logo";
import libraryInfo from "@/data/libraryInfo.json";
import TurnstileWidget from "@/components/security/TurnstileWidget";
import { MEMBER_LANDING_PATH, sanitizeInternalNext } from "@/lib/auth-landing";
import { formatPersonName } from "@/lib/format-person-name";
import { FIELD_LIMITS } from "@/lib/security/field-limits";
import { turnstileRequiredOnClient } from "@/lib/security/turnstile-client";

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const captchaRequired = turnstileRequiredOnClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < FIELD_LIMITS.passwordMin) {
      setError(`Password must be at least ${FIELD_LIMITS.passwordMin} characters.`);
      return;
    }
    if (captchaRequired && !turnstileToken) {
      setError("Complete the security check below.");
      return;
    }

    const formattedName = formatPersonName(fullName);
    setFullName(formattedName);

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formattedName,
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; needsEmailConfirmation?: boolean };
      if (!res.ok || json.ok === false) {
        setError(json.error ?? "Could not create account.");
        setSubmitting(false);
        return;
      }

      if (!json.needsEmailConfirmation) {
        const next = sanitizeInternalNext(searchParams.get("next"));
        router.replace(next ?? MEMBER_LANDING_PATH);
        router.refresh();
        return;
      }

      const q = new URLSearchParams({ registered: "1", confirm: "1" });
      const next = sanitizeInternalNext(searchParams.get("next"));
      if (next) q.set("next", next);
      router.push(`/login?${q.toString()}`);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Create account
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">
            Join {libraryInfo.name}
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            Sign up to get a member number, then sign in to pick plans, seats,
            and renewals.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="fullName"
                className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-ink-500"
              >
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={(e) => setFullName(formatPersonName(e.target.value))}
                required
                minLength={FIELD_LIMITS.nameMin}
                maxLength={FIELD_LIMITS.nameMax}
                className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15"
              />
            </div>

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
              <label
                htmlFor="phone"
                className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-ink-500"
              >
                Phone <span className="font-sans normal-case text-ink-400">(optional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919876543210"
                maxLength={FIELD_LIMITS.phoneMax}
                className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15"
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={FIELD_LIMITS.passwordMin}
                maxLength={FIELD_LIMITS.passwordMax}
                className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15"
              />
            </div>

            <div>
              <label
                htmlFor="confirm"
                className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-ink-500"
              >
                Confirm password
              </label>
              <input
                id="confirm"
                type={showPwd ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                maxLength={FIELD_LIMITS.passwordMax}
                className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15"
              />
            </div>

            <TurnstileWidget onToken={setTurnstileToken} className="mt-2" />

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-azure-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-azure-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Spinner /> Creating account…
                </>
              ) : (
                <>Create member account</>
              )}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-dashed border-azure-200 bg-azure-50/60 p-4 text-xs text-ink-700">
            <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-azure-700">
              <svg
                className="h-3 w-3 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              Member number
            </p>
            <p className="mt-2 leading-relaxed">
              Your <span className="font-semibold text-ink-900">4-digit member number</span>{" "}
              is created automatically when you register — you do not enter it
              here. After signup, sign in to see it on your dashboard; staff use
              it for desk check-in and device setup.
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-ink-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-azure-500 hover:text-azure-600"
            >
              Sign in
            </Link>
          </p>
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
