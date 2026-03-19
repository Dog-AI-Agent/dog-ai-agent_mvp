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
    prevention_tips: list[str] = []
    recommended_ingredients: list[IngredientInDisease] = []


# ── Recommendation ──

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
    feeds: list[dict] = []
    supplements: list[dict] = []
    recipes: list[RecipeCard] = []


# ── Recipe ──

class RecipeIngredient(BaseModel):
    name: str
    amount: Optional[str] = None
    sort_order: int = 0


class RecipeStep(BaseModel):
    step_number: int
    instruction: str


class RecipeNutrition(BaseModel):
    nutrient_name: str
    amount: Optional[float] = None
    unit: Optional[str] = None


class RecipeDetailResponse(BaseModel):
    recipe_id: str
    title: str
    description: Optional[str] = None
    calories_per_serving: Optional[float] = None
    cook_time_min: Optional[int] = None
    difficulty: Optional[str] = None
    servings: int = 1
    ingredients: list[RecipeIngredient] = []
    steps: list[RecipeStep] = []
    target_diseases: list[str] = []
    summary: Optional[str] = None
