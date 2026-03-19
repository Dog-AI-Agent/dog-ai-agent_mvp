from fastapi import APIRouter, HTTPException

from backend.database import get_supabase
from backend.models.schemas import DiseaseDetailResponse, IngredientInDisease

router = APIRouter(prefix="/diseases", tags=["Diseases"])


@router.get("/{disease_id}", response_model=DiseaseDetailResponse)
async def get_disease(disease_id: str):
    db = get_supabase()

    # Get disease
    disease_result = db.table("diseases").select("*").eq("id", disease_id).execute()
    if not disease_result.data:
        raise HTTPException(status_code=404, detail="DISEASE_NOT_FOUND")

    disease = disease_result.data[0]

    # Get recommended ingredients via disease_ingredients junction
    di_result = (
        db.table("disease_ingredients")
        .select("priority, ingredients(id, name_ko, effect_description)")
        .eq("disease_id", disease_id)
        .order("priority", desc=True)
        .execute()
    )

    ingredients = []
    for di in di_result.data:
        ing = di.get("ingredients")
        if ing:
            ingredients.append(IngredientInDisease(
                ingredient_id=ing["id"],
                name_ko=ing.get("name_ko") or "",
                effect_description=ing.get("effect_description"),
                priority=di.get("priority", 0),
            ))

    return DiseaseDetailResponse(
        disease_id=disease["id"],
        name_ko=disease.get("name_ko"),
        name_en=disease["name_en"],
        description=disease.get("description"),
        severity=disease.get("severity", "medium"),
        symptoms=disease.get("symptoms") or [],
        affected_area=disease.get("affected_area"),
        prevention_tips=disease.get("prevention_tips") or [],
        recommended_ingredients=ingredients,
    )
