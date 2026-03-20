import { get } from "./client";
import type { RecipeDetailResponse } from "../types";

export const getRecipe = (
  recipeId: string,
  breedId?: string,
): Promise<RecipeDetailResponse> =>
  get<RecipeDetailResponse>(
    `/recipes/${recipeId}`,
    breedId ? { breed_id: breedId } : undefined,
  );
