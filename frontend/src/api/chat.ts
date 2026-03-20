import { get, post } from "./client";
import type { ChatSession, ChatMessage, ChatHistoryResponse } from "../types";

export const createChatSession = (breedId: string): Promise<ChatSession> =>
  post<ChatSession>(
    "/chat/sessions",
    JSON.stringify({ breed_id: breedId }),
    { "Content-Type": "application/json" },
  );

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

export const getChatHistory = (sessionId: string): Promise<ChatHistoryResponse> =>
  get<ChatHistoryResponse>(`/chat/sessions/${sessionId}/messages`);
