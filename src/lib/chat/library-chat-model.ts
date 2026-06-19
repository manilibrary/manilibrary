import { groq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

export function isLibraryChatConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function libraryChatModel(): LanguageModel {
  const modelId = process.env.LIBRARY_CHAT_GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  return groq(modelId);
}

/** User-safe message (no env var names). */
export function friendlyChatErrorPublic(err: unknown): string {
  const detailed = friendlyChatErrorDetailed(err);
  if (/quota|RESOURCE_EXHAUSTED|limit:\s*0/i.test(detailed)) {
    return "The assistant is unavailable right now (AI provider quota). Please contact the library by phone or WhatsApp.";
  }
  if (/quota|rate.?limit|maxRetriesExceeded/i.test(detailed)) {
    return "The assistant is busy. Please try again in a minute or contact the library directly.";
  }
  return "Something went wrong. Please try again or contact the library.";
}

/** Dev / server logs. */
export function friendlyChatErrorDetailed(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Something went wrong.";

  if (/quota|RESOURCE_EXHAUSTED|rate.?limit|maxRetriesExceeded/i.test(msg)) {
    return `AI provider quota exceeded. ${msg.slice(0, 180)}`;
  }

  return msg.length > 280 ? "Something went wrong." : msg;
}
