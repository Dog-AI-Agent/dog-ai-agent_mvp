export interface TopKPrediction {
  rank: number;
  breed: string;
  probability: number;
  probability_pct: string;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size_bytes: number;
}

export interface BreedRecognitionResponse {
  breed_id: string | null;
  breed_name_ko: string;
  breed_name_en: string;
  confidence: number;
  top_k_predictions: TopKPrediction[];
  inference_time_ms: number;
  image_metadata: ImageMetadata;
  model_version: string;
}

export interface DiseaseInBreed {
  disease_id: string;
  name_ko: string;
  risk_level: string;
  severity: string;
}

export interface BreedListItem {
  breed_id: string;
  name_ko: string;
  name_en: string;
  size_category?: string;
  image_url?: string;
}

export interface BreedListResponse {
  breeds: BreedListItem[];
  total_count: number;
  page: number;
  limit: number;
}

export interface BreedDetailResponse {
  breed_id: string;
  name_ko: string;
  name_en: string;
  size_category?: string;
  avg_weight_kg?: number;
  avg_life_span_years?: number;
  description?: string;
  temperament?: string;
  image_url?: string;
  diseases: DiseaseInBreed[];
}

// ── Disease ──

export interface IngredientInDisease {
  ingredient_id: string;
  name_ko: string;
  effect_description?: string;
  priority: number;
}

export interface DiseaseDetailResponse {
  disease_id: string;
  name_ko?: string;
  name_en: string;
  description?: string;
  severity: string;
  symptoms: string[];
  affected_area?: string;
  prevention_tips?: string;
  source_name?: string;
  source_url?: string;
  recommended_ingredients: IngredientInDisease[];
}

// ── Recommendation (v2: 탭 구조) ──

export interface NutrientItem {
  disease_name_ko: string;
  severity: string;
  recommended_ingredients: IngredientInDisease[];
}

export interface FoodCard {
  food_id: string;
  name_ko: string;
  category?: string;
  image_url?: string;
  related_ingredients: string[];
  recipe_ids: string[];
}

export interface RecipeCard {
  recipe_id: string;
  title: string;
  description?: string;
  difficulty?: string;
  cook_time_min?: number;
  target_diseases: string[];
}

export interface RecommendationResponse {
  breed_name_ko: string;
  summary: string;
  tab_nutrients: NutrientItem[];
  tab_foods: FoodCard[];
  recipes: RecipeCard[];
}

// ── Recipe ──

export interface RecipeIngredient {
  name: string;
  amount?: string;
  sort_order: number;
}

export interface RecipeStep {
  step_number: number;
  instruction: string;
}

// ── Chat ──

export interface ChatSession {
  session_id: string;
  breed_id: string;
  created_at: string;
}

export interface ChatMessage {
  message_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatHistoryResponse {
  session_id: string;
  breed_id: string;
  messages: ChatMessage[];
}

export interface RecipeDetailResponse {
  recipe_id: string;
  title: string;
  description?: string;
  calories_per_serving?: number;
  cook_time_min?: number;
  difficulty?: string;
  servings: number;
  image_url?: string;
  source_name?: string;
  source_url?: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  target_diseases: string[];
  summary?: string;
}
