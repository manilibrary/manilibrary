"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AuthMarketingAside from "@/components/auth/AuthMarketingAside";
import Logo from "@/components/Logo";
import libraryInfo from "@/data/libraryInfo.json";
import { createClient } from "@/lib/supabase/client";
import { clearClientCache } from "@/lib/client-data-cache";
import { clearAllUxPreferenceCookies } from "@/lib/ux-cookies";

export default function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (!cancelled) {
            setError(exchangeError.message);
            setChecking(false);
          }
          return;
        }
        url.searchParams.delete("code");
        const qs = url.searchParams.toString();
        window.history.replaceState(
          {},
          "",
          `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`,
        );
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session) {
        setError(
          "This reset link is invalid or has expired. Request a new one from the sign-in page.",
        );
        setChecking(false);
        return;
      }

      setReady(true);
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    // End recovery session so /login is reachable (proxy otherwise redirects signed-in users away).
    await supabase.auth.signOut();
    clearAllUxPreferenceCookies();
    clearClientCache();
    setSubmitting(false);
    window.location.assign(
      "/login?message=" +
        encodeURIComponent("Password updated. Sign in with your new password."),
    );
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
            New password
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">
            Choose a new password
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            For your {libraryInfo.name} account.
          </p>

          {checking ? (
            <p className="mt-8 text-sm text-ink-500">Verifying reset link…</p>
          ) : !ready ? (
            <div className="mt-6 space-y-4">
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              )}
              <Link
                href="/forgot-password"
                className="inline-block text-sm font-medium text-azure-600 hover:text-azure-700"
              >
                Request a new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block font-mono text-[10px] uppercase tracking-widest text-ink-500"
                  >
                    New password
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
                  minLength={6}
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
                {submitting ? "Saving…" : "Update password"}
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
