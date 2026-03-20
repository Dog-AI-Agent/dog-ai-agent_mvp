from pydantic import BaseModel
from typing import Optional


# ── Breed ──

class DiseaseInBreed(BaseModel):
    disease_id: str
    name_ko: str
    risk_level: str = "medium"
    severity: str = "medium"


class BreedListItem(BaseModel):
    breed_id: str
    name_ko: str
    name_en: str
    size_category: Optional[str] = None
    image_url: Optional[str] = None


class BreedListResponse(BaseModel):
    breeds: list[BreedListItem]
    total_count: int
    page: int
    limit: int


class BreedDetailResponse(BaseModel):
    breed_id: str
    name_ko: str
    name_en: str
    size_category: Optional[str] = None
    avg_weight_kg: Optional[float] = None
    avg_life_span_years: Optional[float] = None
    description: Optional[str] = None
    temperament: Optional[str] = None
    image_url: Optional[str] = None
    diseases: list[DiseaseInBreed] = []


# ── AI ──

class TopKPrediction(BaseModel):
    rank: int
    breed: str
    probability: float
    probability_pct: str


class ImageMetadata(BaseModel):
    width: int
    height: int
    format: str
    size_bytes: int


class BreedRecognitionResponse(BaseModel):
    breed_id: Optional[str] = None
    breed_name_ko: str
    breed_name_en: str
    confidence: float
    top_k_predictions: list[TopKPrediction]
    inference_time_ms: float
    image_metadata: ImageMetadata
    model_version: str = "model_1.h5"


# ── Disease ──

class IngredientInDisease(BaseModel):
    ingredient_id: str
    name_ko: str
    effect_description: Optional[str] = None
    priority: int = 0


class DiseaseDetailResponse(BaseModel):
    disease_id: str
    name_ko: Optional[str] = None
    name_en: str
    description: Optional[str] = None
    severity: str = "medium"
    symptoms: list[str] = []
    affected_area: Optional[str] = None
    prevention_tips: Optional[str] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    recommended_ingredients: list[IngredientInDisease] = []


# ── Recommendation ──

class NutrientItem(BaseModel):
    """탭1: 유전병별 권장 영양소"""
    disease_name_ko: str
    severity: str
    recommended_ingredients: list[IngredientInDisease] = []


class FoodCard(BaseModel):
    """탭2: 추천 음식 카드"""
    food_id: str
    name_ko: str
    category: Optional[str] = None
    image_url: Optional[str] = None
    related_ingredients: list[str] = []
    recipe_ids: list[str] = []


class RecipeCard(BaseModel):
    recipe_id: str
    title: str
    description: Optional[str] = None
    difficulty: Optional[str] = None
    cook_time_min: Optional[int] = None
    target_diseases: list[str] = []


class RecommendationResponse(BaseModel):
    breed_name_ko: str
    summary: str
    tab_nutrients: list[NutrientItem] = []
    tab_foods: list[FoodCard] = []
    recipes: list[RecipeCard] = []


# ── Recipe ──

class RecipeIngredient(BaseModel):
    name: str
    amount: Optional[str] = None
    sort_order: int = 0
    calories_per_100g: int = 0
    calories_small: int = 0
    calories_medium: int = 0
    calories_large: int = 0


class RecipeStep(BaseModel):
    step_number: int
    instruction: str


class RecipeDetailResponse(BaseModel):
    recipe_id: str
    title: str
    description: Optional[str] = None
    calories_per_serving: Optional[int] = None
    cook_time_min: Optional[int] = None
    difficulty: Optional[str] = None
    servings: int = 1
    image_url: Optional[str] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    ingredients: list[RecipeIngredient] = []
    steps: list[RecipeStep] = []
    target_diseases: list[str] = []
    summary: Optional[str] = None


# ── Chat ──

class ChatSessionCreate(BaseModel):
    breed_id: str


class ChatSessionResponse(BaseModel):
    session_id: str
    breed_id: str
    created_at: str


class ChatMessageRequest(BaseModel):
    content: str


class ChatMessageResponse(BaseModel):
    message_id: str
    role: str
    content: str
    created_at: str


class ChatHistoryResponse(BaseModel):
    session_id: str
    breed_id: str
    messages: list[ChatMessageResponse] = []
