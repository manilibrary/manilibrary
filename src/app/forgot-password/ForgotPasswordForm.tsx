"use client";

import Link from "next/link";
import { useState } from "react";
import AuthMarketingAside from "@/components/auth/AuthMarketingAside";
import Logo from "@/components/Logo";
import libraryInfo from "@/data/libraryInfo.json";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    // Server route exchanges PKCE `code` and sets cookies (avoids broken opens
    // from mail in-app browsers). Use this exact URL in Supabase → Redirect URLs.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${origin}/auth/callback`,
      },
    );

    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-white px-6 py-8 md:px-12 lg:px-16">
        <header className="flex items-center justify-between">
          <Logo height={36} />
          <Link
            href="/login"
            className="text-sm text-ink-500 transition-colors hover:text-azure-500"
          >
            Sign in
          </Link>
        </header>

        <div className="mx-auto w-full max-w-md py-10">
          <p className="font-mono text-xs uppercase tracking-widest text-azure-500">
            Reset password
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">
            Forgot your password?
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            Enter the email you use for {libraryInfo.name}. We will send a link
            to choose a new password.
          </p>

          {sent ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900">
              <p className="font-medium">Check your email</p>
              <p className="mt-2 text-emerald-800">
                If an account exists for <span className="font-mono">{email}</span>
                , you will receive a reset link shortly. The link expires after a
                short time. If the page does not load, open the link in Safari or
                Chrome instead of only the in-mail preview.
              </p>
              <Link
                href="/login"
                className="mt-4 inline-block text-sm font-medium text-azure-600 hover:text-azure-700"
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
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
                  className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15"
                />
              </div>

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
                {submitting ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}

        </div>

        <footer className="flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest text-ink-400">
          {libraryInfo.address.city}, {libraryInfo.address.state}
        </footer>
      </section>

      <AuthMarketingAside />
    </div>
  );
}
