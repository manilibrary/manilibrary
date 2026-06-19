import { createUIMessageStream, createUIMessageStreamResponse, generateId, type UIMessage } from "ai";

export function libraryChatRefusalResponse(text: string, originalMessages?: UIMessage[]): Response {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages,
      execute: ({ writer }) => {
        const id = generateId();
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: text });
        writer.write({ type: "text-end", id });
      },
    }),
  });
}
