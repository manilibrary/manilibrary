"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined" && "console" in window) {
      console.error("[global-error]", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          margin: 0,
          padding: 0,
          backgroundColor: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "#2563eb",
              textTransform: "uppercase",
            }}
          >
            Critical error
          </p>
          <h1 style={{ marginTop: 12, fontSize: 28, fontWeight: 600 }}>
            Something broke before we could load the page.
          </h1>
          <p style={{ marginTop: 12, maxWidth: 480, color: "#475569" }}>
            Please reload, or come back in a minute. If you keep seeing this,
            we&apos;d love to hear about it.
          </p>
          {error.message ? (
            <pre
              style={{
                marginTop: 16,
                maxWidth: 540,
                padding: "8px 12px",
                backgroundColor: "#f1f5f9",
                borderRadius: 8,
                fontSize: 12,
                color: "#334155",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {error.message}
              {error.digest ? `\n· ${error.digest}` : ""}
            </pre>
          ) : null}
          <div style={{ marginTop: 24, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "10px 18px",
                borderRadius: 9999,
                fontWeight: 600,
                fontSize: 14,
                color: "#fff",
                backgroundColor: "#2563eb",
                border: "none",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                padding: "10px 18px",
                borderRadius: 9999,
                fontWeight: 600,
                fontSize: 14,
                color: "#1e293b",
                backgroundColor: "#fff",
                border: "1px solid #e2e8f0",
                textDecoration: "none",
              }}
            >
              Go home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
