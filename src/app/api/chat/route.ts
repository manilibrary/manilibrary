import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { apiError } from "@/lib/api/json-response";
import { buildLibraryChatContext } from "@/lib/chat/build-library-chat-context";
import {
  friendlyChatErrorDetailed,
  friendlyChatErrorPublic,
  isLibraryChatConfigured,
  libraryChatModel,
} from "@/lib/chat/library-chat-model";
import { buildLibraryChatSystemPrompt } from "@/lib/chat/library-chat-prompt";
import { offTopicRefusalForMessages } from "@/lib/chat/library-chat-scope";
import { libraryChatRefusalResponse } from "@/lib/chat/library-chat-refusal-response";
import { getClientIp } from "@/lib/security/request-guards";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const maxDuration = 30;

const CHAT_RATE_LIMIT = 40;
const CHAT_RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_MESSAGES = 24;
const MAX_USER_CHARS = 2000;

function trimMessages(messages: UIMessage[]): UIMessage[] {
  return messages.slice(-MAX_MESSAGES).map((m) => {
    if (m.role !== "user") return m;
    const parts = m.parts.map((part) => {
      if (part.type !== "text") return part;
      const text = part.text.length > MAX_USER_CHARS ? part.text.slice(0, MAX_USER_CHARS) : part.text;
      return { ...part, text };
    });
    return { ...m, parts };
  });
}

export async function POST(request: Request) {
  if (process.env.LIBRARY_CHAT_ENABLED === "false") {
    return apiError("Chat is temporarily unavailable.", 503);
  }

  if (!isLibraryChatConfigured()) {
    return apiError("Chat is not configured.", 503);
  }

  const ip = getClientIp(request);
  const limited = checkRateLimit(`chat:ip:${ip}`, CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS);
  if (!limited.allowed) {
    return apiError(`Too many messages. Try again in ${limited.retryAfterSec}s.`, 429);
  }

  let body: { messages?: UIMessage[] };
  try {
    body = (await request.json()) as { messages?: UIMessage[] };
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return apiError("messages array required.", 400);
  }

  const { data: authData } = await getAuthUserForApiRequest(request);
  const user = authData?.user ?? null;

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch {
    return apiError("Chat is temporarily unavailable.", 503);
  }

  const trimmed = trimMessages(messages);
  const refusal = offTopicRefusalForMessages(trimmed);
  if (refusal) {
    return libraryChatRefusalResponse(refusal, trimmed);
  }

  const context = await buildLibraryChatContext(admin, user);
  const system = `${buildLibraryChatSystemPrompt(context.audience)}

CONTEXT (JSON):
${JSON.stringify(context)}`;

  try {
    const result = streamText({
      model: libraryChatModel(),
      system,
      messages: await convertToModelMessages(trimmed),
      maxOutputTokens: 350,
      temperature: 0.2,
      maxRetries: 0,
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        if (process.env.NODE_ENV === "development") {
          console.error("[chat]", friendlyChatErrorDetailed(error));
        }
        return friendlyChatErrorPublic(error);
      },
    });
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[chat]", friendlyChatErrorDetailed(e));
    }
    return apiError(friendlyChatErrorPublic(e), 503);
  }
}
