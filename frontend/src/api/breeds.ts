import { get } from "./client";
import type { BreedListResponse, BreedDetailResponse } from "../types";

export const listBreeds = (params?: {
  search?: string;
  size?: string;
  page?: number;
  limit?: number;
}): Promise<BreedListResponse> =>
  get<BreedListResponse>(
    "/breeds",
    params as Record<string, string | number | undefined>,
  );

export const getBreed = (breedId: string): Promise<BreedDetailResponse> =>
  get<BreedDetailResponse>(`/breeds/${breedId}`);
