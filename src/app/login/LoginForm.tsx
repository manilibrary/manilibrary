"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import libraryInfo from "@/data/libraryInfo.json";

type Role = "admin" | "member";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole = (params.get("role") as Role) ?? "admin";

  const [role, setRole] = useState<Role>(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const r = params.get("role");
    if (r === "admin" || r === "member") setRole(r);
  }, [params]);

  useEffect(() => {
    const creds = libraryInfo.demoCredentials[role];
    setEmail(creds.email);
    setPassword(creds.password);
    setError(null);
  }, [role]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const expected = libraryInfo.demoCredentials[role];
    await new Promise((r) => setTimeout(r, 500));

    if (email === expected.email && password === expected.password) {
      try {
        sessionStorage.setItem(
          "manilibrary:session",
          JSON.stringify({ role, email, at: Date.now() })
        );
      } catch {}

      if (role === "admin") {
        router.push("/dashboard");
      } else {
        router.push("/dashboard/members");
      }
    } else {
      setError("Invalid email or password. Try the demo credentials shown.");
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Form column */}
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
          <p className="font-mono text-xs uppercase tracking-widest text-azure-500">
            // sign_in
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            Sign in to your {libraryInfo.name} account.
          </p>

          {/* Role toggle */}
          <div className="mt-7 inline-flex rounded-full border border-ink-200 bg-ink-50 p-1">
            {(["admin", "member"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  role === r
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-ink-500 hover:text-ink-800"
                }`}
              >
                {r === "admin" ? "Admin" : "Member"}
              </button>
            ))}
          </div>

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
                className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 text-ink-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300 text-azure-500 focus:ring-azure-500"
                  defaultChecked
                />
                Remember me
              </label>
              <a href="#" className="font-medium text-azure-500 hover:text-azure-600">
                Forgot password?
              </a>
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
              {submitting ? (
                <>
                  <Spinner /> Signing in…
                </>
              ) : (
                <>Sign in as {role}</>
              )}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-dashed border-azure-200 bg-azure-50/60 p-4 text-xs text-ink-700">
            <p className="font-mono text-[10px] uppercase tracking-widest text-azure-700">
              demo_credentials
            </p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono">
              <dt className="text-ink-500">email</dt>
              <dd className="text-ink-900">
                {libraryInfo.demoCredentials[role].email}
              </dd>
              <dt className="text-ink-500">password</dt>
              <dd className="text-ink-900">
                {libraryInfo.demoCredentials[role].password}
              </dd>
            </dl>
          </div>

          <p className="mt-6 text-center text-sm text-ink-600">
            New to {libraryInfo.name}?{" "}
            <Link href="/#plans" className="font-medium text-azure-500 hover:text-azure-600">
              View membership plans
            </Link>
          </p>
        </div>

        <footer className="text-center font-mono text-[10px] uppercase tracking-widest text-ink-400">
          {libraryInfo.address.city}, {libraryInfo.address.state} //{" "}
          {libraryInfo.hours}
        </footer>
      </section>

      {/* Visual column */}
      <aside className="relative hidden overflow-hidden bg-ink-900 lg:block">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(800px 400px at 80% 20%, rgba(1,96,208,0.55), transparent 65%), radial-gradient(600px 400px at 20% 80%, rgba(1,96,208,0.35), transparent 60%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="font-mono text-xs uppercase tracking-widest text-azure-200">
            // {libraryInfo.name.toLowerCase().replace(" ", "_")}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-azure-300">
              Members area
            </p>
            <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              Manage seats, payments, and renewals — all from one quiet
              dashboard.
            </h2>
            <ul className="mt-8 space-y-3 text-sm text-ink-200">
              {[
                "Track who has paid and who hasn't",
                "See subscriptions expiring this week",
                "Issue receipts and update plans",
                "Run the library — without spreadsheets",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-azure-400" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <p className="font-mono text-[10px] uppercase tracking-widest text-azure-200">
              live_status
            </p>
            <div className="mt-3 grid grid-cols-3 gap-4 text-center">
              <Stat label="Seats" value={String(libraryInfo.capacity)} />
              <Stat label="Open" value="24/7" />
              <Stat label="Members" value="500+" />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-widest text-ink-300">
        {label}
      </p>
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
      <path
        d="M12 3a9 9 0 1 0 9 9"
        strokeLinecap="round"
      />
    </svg>
  );
}
