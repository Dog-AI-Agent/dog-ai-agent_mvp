from fastapi import APIRouter, HTTPException

from backend.database import get_supabase
from backend.models.schemas import DiseaseDetailResponse, IngredientInDisease

router = APIRouter(prefix="/diseases", tags=["Diseases"])


@router.get("/{disease_id}", response_model=DiseaseDetailResponse)
async def get_disease(disease_id: str):
    db = get_supabase()

    disease_result = db.table("diseases").select("*").eq("id", disease_id).execute()
    if not disease_result.data:
        raise HTTPException(status_code=404, detail="DISEASE_NOT_FOUND")

    d = disease_result.data[0]

    # Get recommended ingredients
    try:
        di_result = (
            db.table("disease_ingredients")
            .select("ingredient_id, effect_description, priority, "
                    "ingredients(id, name_ko, name_en)")
            .eq("disease_id", disease_id)
            .order("priority")
            .execute()
        )
    except Exception:
        # v1: no effect_description
        di_result = (
            db.table("disease_ingredients")
            .select("ingredient_id, priority, "
                    "ingredients(id, name_ko, name_en)")
            .eq("disease_id", disease_id)
            .order("priority")
            .execute()
        )

    recommended_ingredients = []
    for di in di_result.data:
        ing = di.get("ingredients")
        if ing:
            recommended_ingredients.append(IngredientInDisease(
                ingredient_id=ing["id"],
                name_ko=ing.get("name_ko") or ing["name_en"],
                effect_description=di.get("effect_description"),
                priority=di.get("priority", 1),
            ))

    # Handle prevention_tips: v1 = TEXT[], v2 = TEXT
    tips = d.get("prevention_tips")
    if isinstance(tips, list):
        tips = " ".join(tips) if tips else None

    return DiseaseDetailResponse(
        disease_id=d["id"],
        name_ko=d.get("name_ko"),
        name_en=d["name_en"],
        description=d.get("description"),
        severity=d.get("severity", "medium"),
        symptoms=d.get("symptoms") or [],
        affected_area=d.get("affected_area"),
        prevention_tips=tips,
        source_name=d.get("source_name"),
        source_url=d.get("source_url"),
        recommended_ingredients=recommended_ingredients,
    )
