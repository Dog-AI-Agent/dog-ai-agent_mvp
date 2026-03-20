import { get } from "./client";
import type { RecommendationResponse } from "../types";

// DB 데이터만 즉시 반환 (빠름)
export const getRecommendations = (params: {
  breed_id: string;
}): Promise<RecommendationResponse> =>
  get<RecommendationResponse>("/recommendations", params as Record<string, string>);

// LLM summary만 lazy 호출 (느림)
export const getRecommendationSummary = (breed_id: string): Promise<{ summary: string }> =>
  get<{ summary: string }>("/recommendations/summary", { breed_id });
