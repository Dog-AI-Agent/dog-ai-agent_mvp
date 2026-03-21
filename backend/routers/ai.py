from fastapi import APIRouter, UploadFile, File, HTTPException, Request
import httpx
import time
from collections import defaultdict

from backend.config import AI_SERVER_URL
from backend.database import get_supabase
from backend.utils.image_validation import validate_image
from backend.models.schemas import BreedRecognitionResponse, TopKPrediction, ImageMetadata

router = APIRouter(prefix="/ai", tags=["AI"])

# ── 비회원 IP 기반 횟수 제한 (in-memory, 하루 3회) ──
_guest_requests: dict[str, list[float]] = defaultdict(list)
_GUEST_LIMIT = 3
_GUEST_WINDOW = 86400  # 24시간


def _check_guest_rate_limit(ip: str) -> bool:
    now = time.time()
    _guest_requests[ip] = [t for t in _guest_requests[ip] if now - t < _GUEST_WINDOW]
    if len(_guest_requests[ip]) >= _GUEST_LIMIT:
        return False
    _guest_requests[ip].append(now)
    return True


@router.post("/gradcam")
async def gradcam(file: UploadFile = File(...)):
    contents, _ = await validate_image(file)
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{AI_SERVER_URL}/gradcam",
                files={"file": (file.filename, contents, file.content_type)},
            )
    except httpx.ConnectError:
        raise HTTPException(status_code=500, detail="AI server is not available.")
    except httpx.TimeoutException:
        raise HTTPException(status_code=500, detail="AI server timeout.")

    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail="GradCAM 생성 실패.")

    return resp.json()


async def _do_breed_recognition(file: UploadFile) -> BreedRecognitionResponse:
    """공통 품종 인식 로직"""
    contents, metadata = await validate_image(file)

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

    breed_model = ai_result["breed_en"].lower().replace(" ", "_")
    db = get_supabase()
    breed_row = db.table("breeds").select("id").eq("breed_model", breed_model).execute()
    breed_id = breed_row.data[0]["id"] if breed_row.data else None

    top3_breeds = ai_result.get("top3", [])
    breed_ko_map = {}
    if top3_breeds:
        breed_models = [b["breed"].lower().replace(" ", "_") for b in top3_breeds]
        ko_rows = db.table("breeds").select("breed_model, name_ko").in_("breed_model", breed_models).execute()
        breed_ko_map = {r["breed_model"]: r["name_ko"] for r in ko_rows.data}

    top_k = [
        TopKPrediction(
            rank=p["rank"],
            breed=p["breed"],
            breed_ko=breed_ko_map.get(p["breed"].lower().replace(" ", "_")),
            probability=p["probability"],
            probability_pct=p["probability_pct"],
        )
        for p in top3_breeds
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


@router.post("/breed-recognition-guest", response_model=BreedRecognitionResponse)
async def breed_recognition_guest(request: Request, file: UploadFile = File(...)):
    """비회원용 품종 인식 - IP 기반 하루 3회 제한"""
    ip = request.client.host if request.client else "unknown"
    if not _check_guest_rate_limit(ip):
        raise HTTPException(
            status_code=429,
            detail="하루 3회 무료 분석 횟수를 초과했습니다. 로그인 후 이용해주세요."
        )
    return await _do_breed_recognition(file)


@router.post("/breed-recognition", response_model=BreedRecognitionResponse)
async def breed_recognition(file: UploadFile = File(...)):
    return await _do_breed_recognition(file)
