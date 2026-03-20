import re
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

    # ── size_category 기반 칼로리 계산 ──
    size_category = None
    calories_by_size: Optional[int] = recipe.get("calories_per_serving")

    if breed_id:
        breed_result = db.table("breeds").select("name_ko, size_category").eq("id", breed_id).execute()
        if breed_result.data:
            breed = breed_result.data[0]
            size_category = breed.get("size_category")  # small / medium / large / giant

            # 재료별 칼로리 합산 (size 기준, 중복 재료 제거)
            size_col = {
                "small": "calories_small",
                "medium": "calories_medium",
                "large": "calories_large",
                "giant": "calories_large",
            }.get(size_category, "calories_medium")

            # 같은 이름 재료 중복 제거 후 합산
            seen = {}
            for ing in ingredients:
                if ing.name not in seen:
                    seen[ing.name] = getattr(ing, size_col, 0) or 0
            total = sum(seen.values())
            if total > 0:
                calories_by_size = total

    # ── LLM summary ──
    summary = None
    if breed_id:
        breed_result2 = db.table("breeds").select("name_ko, size_category").eq("id", breed_id).execute()
        if breed_result2.data:
            breed = breed_result2.data[0]
            summary = await generate_recipe_summary(
                recipe_title_ko=title,
                ingredient_names=[ing.name for ing in ingredients],
                breed_name_ko=breed["name_ko"],
                breed_size=breed.get("size_category"),
                disease_names=target_diseases,
            )

    # ── LLM 재료 g수 파싱 → 칼로리 재계산 ──
    if summary and calories_by_size is not None:
        # 재료 칼로리 인덱스 (name -> calories_per_100g)
        cal_index = {ing.name: ing.calories_per_100g for ing in ingredients if ing.calories_per_100g > 0}

        # LLM 응답에서 ### 재료 섹션 파싱
        # 예: "- 연어: 150g", "- 블루베리: 50g"
        section_match = re.search(r'###\s*재료\s*\n(.*?)(?=###|$)', summary, re.DOTALL)
        if section_match:
            section = section_match.group(1)
            llm_cal_total = 0
            found = False
            for line in section.split('\n'):
                # "- 재료명: 숫자g" 또는 "- 재료명: 숫자~숫자g" 패턴
                m = re.search(r'[\-•]?\s*([가-힣a-zA-Z\s]+?)\s*:\s*(\d+)(?:~(\d+))?\s*g', line)
                if m:
                    name = m.group(1).strip()
                    g1 = int(m.group(2))
                    g2 = int(m.group(3)) if m.group(3) else g1
                    avg_g = (g1 + g2) / 2

                    # 재료명으로 칼로리 검색 (부분 일치)
                    matched_cal = 0
                    for ing_name, cal in cal_index.items():
                        if ing_name in name or name in ing_name:
                            matched_cal = cal
                            break

                    if matched_cal > 0 and avg_g > 0:
                        llm_cal_total += int(matched_cal * avg_g / 100)
                        found = True

            if found and llm_cal_total > 0:
                calories_by_size = llm_cal_total

    return RecipeDetailResponse(
        recipe_id=recipe["id"],
        title=title,
        description=recipe.get("description"),
        calories_per_serving=calories_by_size,
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
