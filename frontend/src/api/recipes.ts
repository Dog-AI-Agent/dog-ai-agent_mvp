import { get, post } from "./client";
import type { RecipeDetailResponse } from "../types";

export const getRecipe = (
  recipeId: string,
  breedId?: string,
): Promise<RecipeDetailResponse> =>
  get<RecipeDetailResponse>(
    `/recipes/${recipeId}`,
    breedId ? { breed_id: breedId } : undefined,
    60000, // LLM summary 생성 때문에 60초 타임아웃
  );

export const generateRecipeImage = (recipeId: string): Promise<{ image_url: string }> =>
  post<{ image_url: string }>(`/recipes/${recipeId}/generate-image`, "", {}, 90000);
