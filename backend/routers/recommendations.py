from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from backend.database import get_supabase
from backend.utils.disease_filter import sample_diseases_by_risk
from backend.models.schemas import RecommendationResponse, RecipeCard
from backend.services.llm_service import generate_summary

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get("", response_model=RecommendationResponse)
async def get_recommendations(
    breed_id: str = Query(..., description="Breed ID (required)"),
    disease_id: Optional[str] = None,
    type: Optional[str] = None,
):
    db = get_supabase()

    # Get breed
    breed_result = db.table("breeds").select("*").eq("id", breed_id).execute()
    if not breed_result.data:
        raise HTTPException(status_code=404, detail="BREED_NOT_FOUND")

    breed = breed_result.data[0]
    breed_name_ko = breed["name_ko"]

    # Get diseases for this breed
    if disease_id:
        bd_result = (
            db.table("breed_diseases")
            .select("disease_id, diseases(id, name_en, name_ko, is_genetic)")
            .eq("breed_id", breed_id)
            .eq("disease_id", disease_id)
            .execute()
        )
    else:
        bd_result = (
            db.table("breed_diseases")
            .select("disease_id, diseases(id, name_en, name_ko, is_genetic)")
            .eq("breed_id", breed_id)
            .execute()
        )

    # Build disease entries with risk_level for filtering
    all_disease_entries = []
    for bd in bd_result.data:
        d = bd.get("diseases")
        if d:
            all_disease_entries.append({
                "disease_id": bd["disease_id"],
                "name": d.get("name_ko") or d["name_en"],
                "risk_level": bd.get("risk_level", "medium"),
            })

    # Filter: high/medium/low 각 2개씩 랜덤 샘플링
    filtered_entries = sample_diseases_by_risk(all_disease_entries, per_level=2)

    disease_ids = [e["disease_id"] for e in filtered_entries]
    disease_names = [e["name"] for e in filtered_entries]

    # Get recipes linked to these diseases
    recipes = []
    if disease_ids:
        rd_result = (
            db.table("recipe_diseases")
            .select("recipe_id, disease_id, recipes(id, title_en, title_ko, description, difficulty, cook_time_min)")
            .in_("disease_id", disease_ids)
            .execute()
        )

        # Deduplicate recipes and collect target diseases
        seen = {}
        for rd in rd_result.data:
            r = rd.get("recipes")
            if not r:
                continue
            rid = r["id"]
            if rid not in seen:
                seen[rid] = {
                    "recipe": r,
                    "disease_ids": set(),
                }
            seen[rid]["disease_ids"].add(rd["disease_id"])

        # Map disease_id -> name from filtered entries
        disease_name_map = {e["disease_id"]: e["name"] for e in filtered_entries}

        for rid, info in seen.items():
            r = info["recipe"]
            target = [disease_name_map.get(did, "") for did in info["disease_ids"] if disease_name_map.get(did)]
            recipes.append(RecipeCard(
                recipe_id=r["id"],
                title=r.get("title_ko") or r["title_en"],
                description=r.get("description"),
                difficulty=r.get("difficulty"),
                cook_time_min=r.get("cook_time_min"),
                target_diseases=target,
            ))

    # Collect recipe English titles for LLM food translation
    recipe_titles_en = []
    if disease_ids:
        recipe_titles_en = [info["recipe"].get("title_en", "") for info in seen.values()]

    # LLM summary
    summary = await generate_summary(
        breed_name_ko=breed_name_ko,
        breed_size=breed.get("size_category"),
        disease_names=disease_names,
        recipe_titles=recipe_titles_en,
    )

    return RecommendationResponse(
        breed_name_ko=breed_name_ko,
        summary=summary,
        feeds=[],
        supplements=[],
        recipes=recipes[:20],
    )
