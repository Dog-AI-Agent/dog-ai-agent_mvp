import { get } from "./client";
import type { RecommendationResponse } from "../types";

export const getRecommendations = (params: {
  breed_id: string;
  disease_id?: string;
  type?: string;
}): Promise<RecommendationResponse> =>
  get<RecommendationResponse>("/recommendations", params as Record<string, string | number | undefined>);
