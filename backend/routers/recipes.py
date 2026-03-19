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

    # ── Get recipe ──
    recipe_result = db.table("recipes").select("*").eq("id", recipe_id).execute()
    if not recipe_result.data:
        raise HTTPException(status_code=404, detail="RECIPE_NOT_FOUND")

    recipe = recipe_result.data[0]
    title = recipe.get("title") or recipe.get("title_ko") or recipe.get("title_en") or ""

    # Get ingredients
    ing_result = (
        db.table("recipe_ingredients")
        .select("name, amount, sort_order, calories_per_100g, calories_small, calories_medium, calories_large")
        .eq("recipe_id", recipe_id)
        .order("sort_order")
        .execute()
    )
    ingredients = [
        RecipeIngredient(
            name=r["name"],
            amount=r.get("amount"),
            sort_order=r.get("sort_order", 0),
            calories_per_100g=r.get("calories_per_100g", 0),
            calories_small=r.get("calories_small", 0),
            calories_medium=r.get("calories_medium", 0),
            calories_large=r.get("calories_large", 0),
        )
        for r in ing_result.data
    ]

    # ── Get steps (select * to handle both v1 instruction / v2 description) ──
    steps: list[RecipeStep] = []
    try:
        steps_result = (
            db.table("recipe_steps")
            .select("*")
            .eq("recipe_id", recipe_id)
            .order("step_number")
            .execute()
        )
        steps = [
            RecipeStep(
                step_number=r["step_number"],
                instruction=r.get("instruction") or r.get("description") or "",
            )
            for r in steps_result.data
        ]
    except Exception:
        pass

    # ── Get target diseases ──
    target_diseases: list[str] = []
    for table_name in ("recipe_target_diseases", "recipe_diseases"):
        try:
            rd_result = (
                db.table(table_name)
                .select("diseases(name_ko, name_en)")
                .eq("recipe_id", recipe_id)
                .execute()
            )
            target_diseases = [
                rd["diseases"]["name_ko"] or rd["diseases"]["name_en"]
                for rd in rd_result.data
                if rd.get("diseases") and (rd["diseases"].get("name_ko") or rd["diseases"].get("name_en"))
            ]
            break
        except Exception:
            continue

    # ── LLM summary ──
    summary = None
    if breed_id:
        breed_result = db.table("breeds").select("name_ko, size_category").eq("id", breed_id).execute()
        if breed_result.data:
            breed = breed_result.data[0]
            summary = await generate_recipe_summary(
                recipe_title_ko=title,
                ingredient_names=[ing.name for ing in ingredients],
                breed_name_ko=breed["name_ko"],
                breed_size=breed.get("size_category"),
                disease_names=target_diseases,
            )

    return RecipeDetailResponse(
        recipe_id=recipe["id"],
        title=title,
        description=recipe.get("description"),
        calories_per_serving=recipe.get("calories_per_serving"),
        cook_time_min=recipe.get("cook_time_min"),
        difficulty=recipe.get("difficulty"),
        servings=recipe.get("servings", 1),
        image_url=recipe.get("image_url"),
        source_name=recipe.get("source_name"),
        source_url=recipe.get("source_url"),
        ingredients=ingredients,
        steps=steps,
        target_diseases=target_diseases,
        summary=summary,
    )
