import { get, post, fetchStream } from "./client";
import type { ChatSession, ChatMessage, ChatHistoryResponse } from "../types";

const parseNDJSON = async (
  response: Response,
  onToken: (token: string) => void,
  onDone: (data: { message_id: string; content: string }) => void,
  onError: (error: Error) => void,
) => {
  const reader = response.body?.getReader();
  if (!reader) {
    onError(new Error("ReadableStream not supported"));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.done) {
            onDone({ message_id: parsed.message_id, content: parsed.content });
          } else if (parsed.token !== undefined) {
            onToken(parsed.token);
          }
        } catch {
          // skip malformed lines
        }
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
};

export const createChatSession = (breedId: string): Promise<ChatSession> =>
  post<ChatSession>("/chat/sessions", JSON.stringify({ breed_id: breedId }), {
    "Content-Type": "application/json",
  });

export const sendChatMessage = (
  sessionId: string,
  content: string,
): Promise<ChatMessage> =>
  post<ChatMessage>(
    `/chat/sessions/${sessionId}/messages`,
    JSON.stringify({ content }),
    { "Content-Type": "application/json" },
    60000, // 60s timeout for LLM
  );

export const getChatHistory = (
  sessionId: string,
): Promise<ChatHistoryResponse> =>
  get<ChatHistoryResponse>(`/chat/sessions/${sessionId}/messages`);

export const sendChatMessageStream = (
  sessionId: string,
  content: string,
  onToken: (token: string) => void,
  onDone: (data: { message_id: string; content: string }) => void,
  onError: (error: Error) => void,
) => {
  const controller = new AbortController();

  fetchStream(`/chat/sessions/${sessionId}/messages/stream`, {
    method: "POST",
    body: JSON.stringify({ content }),
    headers: { "Content-Type": "application/json" },
    timeout: 60000,
  })
    .then((res) => parseNDJSON(res, onToken, onDone, onError))
    .catch(onError);

  return { abort: () => controller.abort() };
};
