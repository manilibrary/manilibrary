"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { friendlyChatErrorPublic } from "@/lib/chat/library-chat-model";

function messageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

const CHAT_INTRO_KEY = "manilibrary-chat-intro-seen";
const FAB_SIZE = 56;

function fabInset(): { right: number; bottom: number } {
  return window.innerWidth >= 640 ? { right: 24, bottom: 24 } : { right: 16, bottom: 16 };
}

function fabCenterOffset(): { x: number; y: number } {
  const { right, bottom } = fabInset();
  const half = FAB_SIZE / 2;
  return {
    x: -(window.innerWidth / 2 - right - half),
    y: -(window.innerHeight / 2 - bottom - half),
  };
}

function quadBezier(p0: number, p1: number, p2: number, t: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

type IntroPhase = "done" | "enter" | "label" | "travel";

export default function LibraryChatWidget() {
  const auth = useAuthSession();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [introPhase, setIntroPhase] = useState<IntroPhase>("done");
  const [fabTransform, setFabTransform] = useState("translate(0px, 0px)");
  const travelRafRef = useRef(0);

  const finishIntro = useCallback(() => {
    if (travelRafRef.current) {
      window.cancelAnimationFrame(travelRafRef.current);
      travelRafRef.current = 0;
    }
    setIntroPhase("done");
    setFabTransform("translate(0px, 0px)");
    try {
      sessionStorage.setItem(CHAT_INTRO_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(CHAT_INTRO_KEY) === "1") return;
    } catch {
      // ignore
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishIntro();
      return;
    }

    const center = fabCenterOffset();
    setFabTransform(`translate(${center.x}px, ${center.y}px)`);
    setIntroPhase("enter");

    const t1 = window.setTimeout(() => setIntroPhase("label"), 600);
    const t2 = window.setTimeout(() => setIntroPhase("travel"), 2600);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [finishIntro]);

  useEffect(() => {
    if (introPhase === "enter" || introPhase === "label") {
      const center = fabCenterOffset();
      setFabTransform(`translate(${center.x}px, ${center.y}px)`);
    }
  }, [introPhase]);

  useEffect(() => {
    if (introPhase !== "travel") return;

    const start = fabCenterOffset();
    const end = { x: 0, y: 0 };
    const arcLift = Math.min(180, window.innerHeight * 0.22);
    const control = {
      x: start.x * 0.55,
      y: start.y - arcLift,
    };
    const duration = 1100;
    const t0 = performance.now();

    const tick = (now: number) => {
      const raw = Math.min(1, (now - t0) / duration);
      const t = easeInOutCubic(raw);
      const x = quadBezier(start.x, control.x, end.x, t);
      const y = quadBezier(start.y, control.y, end.y, t);
      setFabTransform(`translate(${x}px, ${y}px)`);

      if (raw < 1) {
        travelRafRef.current = window.requestAnimationFrame(tick);
      } else {
        travelRafRef.current = 0;
        finishIntro();
      }
    };

    travelRafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (travelRafRef.current) {
        window.cancelAnimationFrame(travelRafRef.current);
        travelRafRef.current = 0;
      }
    };
  }, [introPhase, finishIntro]);

  const introActive = introPhase !== "done";

  const dismissIntro = useCallback(() => {
    finishIntro();
  }, [finishIntro]);

  const toggleOpen = () => {
    dismissIntro();
    setOpen((v) => !v);
  };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        credentials: "include",
      }),
    [],
  );

  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
  });

  const busy = status === "submitted" || status === "streaming";
  const audienceLabel = auth.signedIn ? "Signed in — personal answers enabled" : "Public — sign in for your account details";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    clearError();
    sendMessage({ text });
    setInput("");
  };

  return (
    <>
      {open ? (
        <div
          className="fixed bottom-20 right-4 z-[60] flex h-[min(32rem,calc(100vh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-2xl sm:bottom-24 sm:right-6"
          role="dialog"
          aria-label="Library assistant chat"
        >
          <header className="flex items-start justify-between gap-3 border-b border-ink-100 bg-ink-50/80 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink-900">Library assistant</h2>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-500">{audienceLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 rounded-full p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
              aria-label="Close chat"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <p className="text-sm text-ink-600">
                Ask about Mani Library only — plans, hours, location, membership, referrals, or your account
                {auth.signedIn ? "." : ". Sign in for personal details."}
              </p>
            ) : null}
            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={
                      isUser
                        ? "max-w-[90%] rounded-2xl rounded-br-md bg-azure-500 px-3 py-2 text-sm text-white"
                        : "max-w-[90%] rounded-2xl rounded-bl-md border border-ink-100 bg-ink-50 px-3 py-2 text-sm text-ink-800 whitespace-pre-wrap"
                    }
                  >
                    {messageText(message)}
                  </div>
                </div>
              );
            })}
            {busy ? (
              <p className="text-xs text-ink-400">Thinking…</p>
            ) : null}
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {friendlyChatErrorPublic(error)}
              </p>
            ) : null}
          </div>

          <form onSubmit={submit} className="border-t border-ink-100 p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
                placeholder="Type a message…"
                className="min-w-0 flex-1 rounded-xl border border-ink-200 px-3 py-2 text-sm text-ink-900 outline-none focus:border-azure-500 focus:ring-2 focus:ring-azure-500/15 disabled:bg-ink-50"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="shrink-0 rounded-xl bg-azure-500 px-4 py-2 text-sm font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {introActive ? (
        <div
          className="pointer-events-none fixed inset-0 z-[55] bg-ink-900/20 backdrop-blur-sm transition-[backdrop-filter,background-color] duration-300 sm:backdrop-blur-md"
          aria-hidden
        />
      ) : null}

      <div
        className="fixed bottom-4 right-4 z-[60] will-change-transform sm:bottom-6 sm:right-6"
        style={{ transform: introActive ? fabTransform : undefined }}
      >
        <div className="relative h-14 w-14">
          <button
            type="button"
            onClick={toggleOpen}
            className={`flex h-14 w-14 items-center justify-center rounded-full bg-azure-500 text-white shadow-lg hover:bg-azure-600 ${introPhase === "enter" ? "chat-fab-icon-in" : ""}`}
            aria-label={open ? "Close library assistant" : "Ask our AI — open library assistant"}
          >
            {open ? (
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path
                  d="M8 10h8M8 14h5M12 3a9 9 0 100 18 9 9 0 000-18z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>

          {introPhase === "label" ? (
            <span
              className="chat-fab-label-in pointer-events-none absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap rounded-full border border-ink-100 bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 shadow-lg"
              aria-hidden
            >
              Ask our AI
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}
