import { get, fetchStream } from "./client";
import type { RecommendationResponse } from "../types";

// DB 데이터만 즉시 반환 (빠름)
export const getRecommendations = (params: {
  breed_id: string;
}): Promise<RecommendationResponse> =>
  get<RecommendationResponse>(
    "/recommendations",
    params as Record<string, string>,
  );

// LLM summary만 lazy 호출 (느림)
export const getRecommendationSummary = (
  breed_id: string,
): Promise<{ summary: string }> =>
  get<{ summary: string }>("/recommendations/summary", { breed_id });

// LLM summary 스트리밍 호출
export const getRecommendationSummaryStream = (
  breedId: string,
  onToken: (token: string) => void,
  onDone: (summary: string) => void,
  onError: (error: Error) => void,
) => {
  const controller = new AbortController();

  fetchStream("/recommendations/summary/stream", {
    params: { breed_id: breedId },
    timeout: 60000,
  })
    .then(async (res) => {
      const reader = res.body?.getReader();
      if (!reader) {
        onError(new Error("ReadableStream not supported"));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

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
              onDone(parsed.summary);
            } else if (parsed.token !== undefined) {
              onToken(parsed.token);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    })
    .catch(onError);

  return { abort: () => controller.abort() };
};
