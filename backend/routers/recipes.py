from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from backend.database import get_supabase
from backend.models.schemas import (
    RecipeDetailResponse,
    RecipeIngredient,
    RecipeStep,
)
from backend.services.llm_service import generate_recipe_summary

router = APIRouter(prefix="/recipes", tags=["Recipes"])


@router.get("/{recipe_id}", response_model=RecipeDetailResponse)
async def get_recipe(
    recipe_id: str,
    breed_id: Optional[str] = Query(None, description="품종 ID (LLM 안내 생성용)"),
):
    db = get_supabase()

    # Get recipe
    recipe_result = db.table("recipes").select("*").eq("id", recipe_id).execute()
    if not recipe_result.data:
        raise HTTPException(status_code=404, detail="RECIPE_NOT_FOUND")

    recipe = recipe_result.data[0]

    # Get ingredients
    ing_result = (
        db.table("recipe_ingredients")
        .select("name, amount, sort_order")
        .eq("recipe_id", recipe_id)
        .order("sort_order")
        .execute()
    )
    ingredients = [
        RecipeIngredient(name=r["name"], amount=r.get("amount"), sort_order=r.get("sort_order", 0))
        for r in ing_result.data
    ]

    # Get steps
    steps_result = (
        db.table("recipe_steps")
        .select("step_number, instruction")
        .eq("recipe_id", recipe_id)
        .order("step_number")
        .execute()
    )
    steps = [
        RecipeStep(step_number=r["step_number"], instruction=r["instruction"])
        for r in steps_result.data
    ]

    # Get target diseases
    rd_result = (
        db.table("recipe_diseases")
        .select("diseases(name_ko, name_en)")
        .eq("recipe_id", recipe_id)
        .execute()
    )
    target_diseases = [
        rd["diseases"]["name_ko"] or rd["diseases"]["name_en"]
        for rd in rd_result.data
        if rd.get("diseases") and (rd["diseases"].get("name_ko") or rd["diseases"].get("name_en"))
    ]

    # LLM summary (only when breed_id is provided)
    summary = None
    if breed_id:
        breed_result = db.table("breeds").select("name_ko, size_category").eq("id", breed_id).execute()
        if breed_result.data:
            breed = breed_result.data[0]
            summary = await generate_recipe_summary(
                recipe_title_ko=recipe.get("title_ko") or recipe["title_en"],
                ingredient_names=[ing.name for ing in ingredients],
                breed_name_ko=breed["name_ko"],
                breed_size=breed.get("size_category"),
                disease_names=target_diseases,
            )

    return RecipeDetailResponse(
        recipe_id=recipe["id"],
        title=recipe.get("title_ko") or recipe["title_en"],
        description=recipe.get("description"),
        calories_per_serving=recipe.get("calories_per_serving"),
        cook_time_min=recipe.get("cook_time_min"),
        difficulty=recipe.get("difficulty"),
        servings=recipe.get("servings", 1),
        ingredients=ingredients,
        steps=steps,
        target_diseases=target_diseases,
        summary=summary,
    )
