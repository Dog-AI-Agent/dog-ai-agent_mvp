from fastapi import APIRouter, UploadFile, File, HTTPException
import httpx

from backend.config import AI_SERVER_URL
from backend.database import get_supabase
from backend.utils.image_validation import validate_image
from backend.models.schemas import BreedRecognitionResponse, TopKPrediction, ImageMetadata

router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/breed-recognition", response_model=BreedRecognitionResponse)
async def breed_recognition(file: UploadFile = File(...)):
    contents, metadata = await validate_image(file)

    # Call AI server
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{AI_SERVER_URL}/detect-and-classify",
                files={"file": (file.filename, contents, file.content_type)},
            )
    except httpx.ConnectError:
        raise HTTPException(status_code=500, detail="AI server is not available.")
    except httpx.TimeoutException:
        raise HTTPException(status_code=500, detail="AI server timeout.")

    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail="AI server error.")

    ai_result = resp.json()

    if not ai_result.get("is_dog"):
        raise HTTPException(status_code=422, detail="No dog detected in the image.")

    # Look up breed_id from DB
    breed_model = ai_result["breed_en"].lower().replace(" ", "_")
    db = get_supabase()
    breed_row = db.table("breeds").select("id").eq("breed_model", breed_model).execute()
    breed_id = breed_row.data[0]["id"] if breed_row.data else None

    top_k = [
        TopKPrediction(
            rank=p["rank"],
            breed=p["breed"],
            probability=p["probability"],
            probability_pct=p["probability_pct"],
        )
        for p in ai_result.get("top3", [])
    ]

    return BreedRecognitionResponse(
        breed_id=breed_id,
        breed_name_ko=ai_result["breed_ko"],
        breed_name_en=ai_result["breed_en"],
        confidence=ai_result["confidence"],
        top_k_predictions=top_k,
        inference_time_ms=ai_result["inference_time_ms"],
        image_metadata=ImageMetadata(**metadata),
        model_version="model_1.h5",
    )
