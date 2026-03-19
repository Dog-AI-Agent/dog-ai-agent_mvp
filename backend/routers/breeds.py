from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from backend.database import get_supabase
from backend.models.schemas import (
    BreedListResponse,
    BreedListItem,
    BreedDetailResponse,
    DiseaseInBreed,
)

router = APIRouter(prefix="/breeds", tags=["Breeds"])


@router.get("", response_model=BreedListResponse)
async def list_breeds(
    search: Optional[str] = None,
    size: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    db = get_supabase()
    query = db.table("breeds").select("id, name_ko, name_en, size_category, image_url", count="exact")

    if search:
        query = query.or_(f"name_ko.ilike.%{search}%,name_en.ilike.%{search}%")
    if size:
        query = query.eq("size_category", size)

    offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1).order("name_ko")

    result = query.execute()

    breeds = [
        BreedListItem(
            breed_id=r["id"],
            name_ko=r["name_ko"],
            name_en=r["name_en"],
            size_category=r.get("size_category"),
            image_url=r.get("image_url"),
        )
        for r in result.data
    ]

    return BreedListResponse(
        breeds=breeds,
        total_count=result.count or 0,
        page=page,
        limit=limit,
    )


@router.get("/{breed_id}", response_model=BreedDetailResponse)
async def get_breed(breed_id: str):
    db = get_supabase()

    # Get breed
    breed_result = db.table("breeds").select("*").eq("id", breed_id).execute()
    if not breed_result.data:
        raise HTTPException(status_code=404, detail="BREED_NOT_FOUND")

    breed = breed_result.data[0]

    # Get diseases via breed_diseases junction
    bd_result = (
        db.table("breed_diseases")
        .select("disease_id, risk_level, diseases(id, name_ko, severity)")
        .eq("breed_id", breed_id)
        .execute()
    )

    diseases = []
    for bd in bd_result.data:
        d = bd.get("diseases")
        if d:
            diseases.append(DiseaseInBreed(
                disease_id=d["id"],
                name_ko=d.get("name_ko") or "",
                risk_level=bd.get("risk_level", "medium"),
                severity=d.get("severity", "medium"),
            ))

    return BreedDetailResponse(
        breed_id=breed["id"],
        name_ko=breed["name_ko"],
        name_en=breed["name_en"],
        size_category=breed.get("size_category"),
        avg_weight_kg=breed.get("avg_weight_kg"),
        avg_life_span_years=breed.get("avg_life_span_years"),
        description=breed.get("description"),
        temperament=breed.get("temperament"),
        image_url=breed.get("image_url"),
        diseases=diseases,
    )
