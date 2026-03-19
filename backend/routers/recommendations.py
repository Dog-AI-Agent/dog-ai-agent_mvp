from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from backend.database import get_supabase
from backend.models.schemas import (
    RecommendationResponse,
    NutrientItem,
    FoodCard,
    RecipeCard,
    IngredientInDisease,
)
from backend.services.llm_service import generate_summary

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


def _table_exists(db, table_name: str) -> bool:
    try:
        db.table(table_name).select("*", count="exact").limit(0).execute()
        return True
    except Exception:
        return False


@router.get("", response_model=RecommendationResponse)
async def get_recommendations(
    breed_id: str = Query(..., description="Breed ID (required)"),
):
    db = get_supabase()

    # ── Detect schema version ──
    has_foods_table = _table_exists(db, "foods")
    has_recipe_target_diseases = _table_exists(db, "recipe_target_diseases")
    recipe_diseases_table = "recipe_target_diseases" if has_recipe_target_diseases else "recipe_diseases"

    # ── Get breed ──
    breed_result = db.table("breeds").select("*").eq("id", breed_id).execute()
    if not breed_result.data:
        raise HTTPException(status_code=404, detail="BREED_NOT_FOUND")

    breed = breed_result.data[0]
    breed_name_ko = breed["name_ko"]
    summary = breed.get("summary") or ""

    # ── Get diseases ──
    bd_result = (
        db.table("breed_diseases")
        .select("disease_id, risk_level, diseases(id, name_en, name_ko, severity)")
        .eq("breed_id", breed_id)
        .execute()
    )

    disease_ids = []
    disease_names = []
    disease_map: dict[str, dict] = {}
    for bd in bd_result.data:
        d = bd.get("diseases")
        if d:
            disease_ids.append(d["id"])
            name = d.get("name_ko") or d["name_en"]
            disease_names.append(name)
            disease_map[d["id"]] = {
                "name_ko": name,
                "severity": d.get("severity", "medium"),
            }

    # ── 탭1: 유전병별 권장 영양소 ──
    tab_nutrients: list[NutrientItem] = []
    di_data: list[dict] = []
    if disease_ids:
        # Try v2 first (with effect_description), fallback v1
        try:
            di_result = (
                db.table("disease_ingredients")
                .select("disease_id, ingredient_id, effect_description, priority, "
                        "ingredients(id, name_ko, name_en)")
                .in_("disease_id", disease_ids)
                .order("priority")
                .execute()
            )
            di_data = di_result.data
        except Exception:
            di_result = (
                db.table("disease_ingredients")
                .select("disease_id, ingredient_id, priority, "
                        "ingredients(id, name_ko, name_en)")
                .in_("disease_id", disease_ids)
                .order("priority")
                .execute()
            )
            di_data = di_result.data

        disease_ingredients: dict[str, list[IngredientInDisease]] = {}
        for di in di_data:
            did = di["disease_id"]
            ing = di.get("ingredients")
            if not ing:
                continue
            if did not in disease_ingredients:
                disease_ingredients[did] = []
            disease_ingredients[did].append(IngredientInDisease(
                ingredient_id=ing["id"],
                name_ko=ing.get("name_ko") or ing["name_en"],
                effect_description=di.get("effect_description"),
                priority=di.get("priority", 1),
            ))

        for did, info in disease_map.items():
            tab_nutrients.append(NutrientItem(
                disease_name_ko=info["name_ko"],
                severity=info["severity"],
                recommended_ingredients=disease_ingredients.get(did, []),
            ))

    # ── 탭2: 추천 음식 카드 (v2 only) ──
    tab_foods: list[FoodCard] = []
    if disease_ids and has_foods_table:
        ingredient_ids = set()
        for di in di_data:
            ing = di.get("ingredients")
            if ing:
                ingredient_ids.add(ing["id"])

        if ingredient_ids:
            try:
                fi_result = (
                    db.table("food_ingredients")
                    .select("food_id, ingredient_id, foods(id, name_en, name_ko, category, image_url)")
                    .in_("ingredient_id", list(ingredient_ids))
                    .execute()
                )

                food_data: dict[str, dict] = {}
                for fi in fi_result.data:
                    f = fi.get("foods")
                    if not f:
                        continue
                    fid = f["id"]
                    if fid not in food_data:
                        food_data[fid] = {"food": f, "ingredient_names": set()}
                    ing_id = fi["ingredient_id"]
                    for di in di_data:
                        if di.get("ingredients", {}).get("id") == ing_id:
                            name = di["ingredients"].get("name_ko") or di["ingredients"]["name_en"]
                            food_data[fid]["ingredient_names"].add(name)

                food_ids = list(food_data.keys())
                recipe_by_food: dict[str, list[str]] = {}
                if food_ids:
                    try:
                        rf_result = (
                            db.table("recipe_foods")
                            .select("food_id, recipe_id")
                            .in_("food_id", food_ids)
                            .execute()
                        )
                        for rf in rf_result.data:
                            fid = rf["food_id"]
                            if fid not in recipe_by_food:
                                recipe_by_food[fid] = []
                            recipe_by_food[fid].append(rf["recipe_id"])
                    except Exception:
                        pass

                for fid, fd in food_data.items():
                    f = fd["food"]
                    tab_foods.append(FoodCard(
                        food_id=fid,
                        name_ko=f.get("name_ko") or f["name_en"],
                        category=f.get("category"),
                        image_url=f.get("image_url"),
                        related_ingredients=sorted(fd["ingredient_names"]),
                        recipe_ids=recipe_by_food.get(fid, []),
                    ))
            except Exception:
                pass

    # ── 레시피 카드 — recipes(*) 로 안전하게 ──
    recipes: list[RecipeCard] = []
    if disease_ids:
        try:
            rd_result = (
                db.table(recipe_diseases_table)
                .select("recipe_id, disease_id, recipes(*)")
                .in_("disease_id", disease_ids)
                .execute()
            )
        except Exception:
            rd_result = type('obj', (object,), {'data': []})()

        seen: dict[str, dict] = {}
        for rd in rd_result.data:
            r = rd.get("recipes")
            if not r:
                continue
            rid = r["id"]
            if rid not in seen:
                seen[rid] = {"recipe": r, "disease_ids": set()}
            seen[rid]["disease_ids"].add(rd["disease_id"])

        for rid, info in seen.items():
            r = info["recipe"]
            title = r.get("title") or r.get("title_ko") or r.get("title_en") or ""
            target = [disease_map[did]["name_ko"] for did in info["disease_ids"] if did in disease_map]
            recipes.append(RecipeCard(
                recipe_id=r["id"],
                title=title,
                description=r.get("description"),
                difficulty=r.get("difficulty"),
                cook_time_min=r.get("cook_time_min"),
                target_diseases=target,
            ))

    # ── LLM summary fallback ──
    if not summary:
        summary = await generate_summary(
            breed_name_ko=breed_name_ko,
            breed_size=breed.get("size_category"),
            disease_names=disease_names,
            recipe_titles=[r.title for r in recipes[:5]],
        )

    return RecommendationResponse(
        breed_name_ko=breed_name_ko,
        summary=summary,
        tab_nutrients=tab_nutrients,
        tab_foods=tab_foods,
        recipes=recipes[:20],
    )
