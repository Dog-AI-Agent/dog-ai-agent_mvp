import io
import base64
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Optional
from PIL import Image as PILImage

from backend.database import get_supabase
from backend.deps import get_current_user_id
from backend.models.schemas import (
    AnalysisDeleteRequest,
    AnalysisHistoryResponse,
    DogCreateRequest,
    DogResponse,
    DogUpdateRequest,
    UserResponse,
    UserUpdateRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["users"])

# 썸네일 최대 너비/높이 (px) 및 JPEG 압축 품질
THUMB_MAX_PX = 480
THUMB_QUALITY = 75


def _compress_image_to_base64(image_data: bytes) -> str | None:
    """
    이미지를 썸네일로 압축한 뒤 base64 data URL로 반환.
    Supabase Storage JWT 이슈 없이 DB text 컬럼에 직접 저장하기 위해 사용.
    """
    try:
        img = PILImage.open(io.BytesIO(image_data))
        # RGBA / 팔레트 → RGB 변환 (JPEG는 RGBA 미지원)
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        # 비율 유지하며 리사이즈
        img.thumbnail((THUMB_MAX_PX, THUMB_MAX_PX), PILImage.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=THUMB_QUALITY, optimize=True)
        encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
        print(f"[IMAGE] 압축 완료: {len(buf.getvalue())} bytes → base64 {len(encoded)} chars")
        return f"data:image/jpeg;base64,{encoded}"
    except Exception as e:
        print(f"[IMAGE] 압축 실패: {e}")
        return None


def _to_user_response(row: dict) -> UserResponse:
    birth = row.get("birth_date")
    return UserResponse(
        user_id=str(row["id"]),
        name=row["name"],
        email=row["email"],
        nickname=row["nickname"],
        birth_date=str(birth) if birth else None,
        address=row.get("address"),
        created_at=str(row["created_at"]),
    )


def _to_dog_response(row: dict, breed_name_ko: str | None = None) -> DogResponse:
    birthday = row.get("birthday")
    return DogResponse(
        dog_id=str(row["id"]),
        user_id=str(row["user_id"]),
        name=row["name"],
        birthday=str(birthday) if birthday else None,
        breed_id=str(row["breed_id"]) if row.get("breed_id") else None,
        breed_name_ko=breed_name_ko,
        favorite_ingredients=row.get("favorite_ingredients") or [],
        created_at=str(row["created_at"]),
    )


def _to_analysis_response(row: dict) -> AnalysisHistoryResponse:
    return AnalysisHistoryResponse(
        history_id=str(row["id"]),
        breed_id=str(row["breed_id"]) if row.get("breed_id") else None,
        breed_name_ko=row["breed_name_ko"],
        breed_name_en=row.get("breed_name_en"),
        confidence=row.get("confidence"),
        is_mixed_breed=row.get("is_mixed_breed") or False,
        image_url=row.get("image_url"),
        created_at=str(row["created_at"]),
    )


# ── 내 정보 조회 ──
@router.get("/me", response_model=UserResponse)
async def get_me(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    result = db.table("users").select("*").eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return _to_user_response(result.data[0])


# ── 내 정보 수정 ──
@router.put("/me", response_model=UserResponse)
async def update_me(body: UserUpdateRequest, user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="수정할 내용이 없습니다.")
    if "nickname" in updates:
        existing = db.table("users").select("id").eq("nickname", updates["nickname"]).neq("id", user_id).execute()
        if existing.data:
            raise HTTPException(status_code=409, detail="이미 사용 중인 닉네임입니다.")
    result = db.table("users").update(updates).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="정보 수정 중 오류가 발생했습니다.")
    return _to_user_response(result.data[0])


# ── 내 개 정보 조회 ──
@router.get("/me/dog", response_model=DogResponse | None)
async def get_my_dog(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    result = db.table("dogs").select("*").eq("user_id", user_id).execute()
    if not result.data:
        return None
    dog = result.data[0]
    breed_name_ko = None
    if dog.get("breed_id"):
        breed = db.table("breeds").select("name_ko").eq("id", dog["breed_id"]).execute()
        if breed.data:
            breed_name_ko = breed.data[0]["name_ko"]
    return _to_dog_response(dog, breed_name_ko)


# ── 내 개 정보 등록 ──
@router.post("/me/dog", response_model=DogResponse, status_code=201)
async def create_my_dog(body: DogCreateRequest, user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    existing = db.table("dogs").select("id").eq("user_id", user_id).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="이미 등록된 반려견이 있습니다.")
    new_dog = {
        "user_id": user_id, "name": body.name, "birthday": body.birthday,
        "breed_id": body.breed_id, "favorite_ingredients": body.favorite_ingredients or [],
    }
    result = db.table("dogs").insert(new_dog).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="반려견 정보 등록 중 오류가 발생했습니다.")
    dog = result.data[0]
    breed_name_ko = None
    if dog.get("breed_id"):
        breed = db.table("breeds").select("name_ko").eq("id", dog["breed_id"]).execute()
        if breed.data:
            breed_name_ko = breed.data[0]["name_ko"]
    return _to_dog_response(dog, breed_name_ko)


# ── 내 개 정보 수정 ──
@router.put("/me/dog", response_model=DogResponse)
async def update_my_dog(body: DogUpdateRequest, user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    existing = db.table("dogs").select("id").eq("user_id", user_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="등록된 반려견이 없습니다.")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="수정할 내용이 없습니다.")
    result = db.table("dogs").update(updates).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="반려견 정보 수정 중 오류가 발생했습니다.")
    dog = result.data[0]
    breed_name_ko = None
    if dog.get("breed_id"):
        breed = db.table("breeds").select("name_ko").eq("id", dog["breed_id"]).execute()
        if breed.data:
            breed_name_ko = breed.data[0]["name_ko"]
    return _to_dog_response(dog, breed_name_ko)


# ── 분석 히스토리 저장 ──
@router.post("/me/analyses", response_model=AnalysisHistoryResponse, status_code=201)
async def save_analysis(
    breed_name_ko: str = Form(...),
    breed_id: Optional[str] = Form(None),
    breed_name_en: Optional[str] = Form(None),
    confidence: Optional[float] = Form(None),
    is_mixed_breed: bool = Form(False),
    image: Optional[UploadFile] = File(None),
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    image_url = None

    print(f"[ANALYSIS] 저장 요청: breed={breed_name_ko}, image={image.filename if image else 'None'}")

    if image:
        image_data = await image.read()
        print(f"[ANALYSIS] 이미지 수신: {len(image_data)} bytes, type={image.content_type}")
        if image_data:
            image_url = _compress_image_to_base64(image_data)
    else:
        print("[ANALYSIS] 이미지 없음 (image=None)")

    row = {
        "user_id": user_id,
        "breed_id": breed_id if breed_id else None,
        "breed_name_ko": breed_name_ko,
        "breed_name_en": breed_name_en,
        "confidence": confidence,
        "is_mixed_breed": is_mixed_breed,
        "image_url": image_url,
    }
    preview = (image_url[:40] + "...") if image_url and len(image_url) > 40 else image_url
    print(f"[ANALYSIS] DB 저장: image_url={preview}")
    result = db.table("analysis_history").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="히스토리 저장 중 오류가 발생했습니다.")
    return _to_analysis_response(result.data[0])


# ── 분석 히스토리 조회 ──
@router.get("/me/analyses", response_model=list[AnalysisHistoryResponse])
async def get_analyses(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    result = (
        db.table("analysis_history")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [_to_analysis_response(r) for r in result.data]


# ── 분석 히스토리 선택 삭제 ──
@router.post("/me/analyses/delete", status_code=200)
async def delete_analyses(
    body: AnalysisDeleteRequest,
    user_id: str = Depends(get_current_user_id),
):
    if not body.history_ids:
        raise HTTPException(status_code=400, detail="삭제할 항목을 선택해주세요.")
    db = get_supabase()
    deleted_count = 0
    for history_id in body.history_ids:
        try:
            result = (
                db.table("analysis_history")
                .delete()
                .eq("id", history_id)
                .eq("user_id", user_id)
                .execute()
            )
            if result.data:
                deleted_count += 1
        except Exception as e:
            logger.warning(f"항목 삭제 실패 {history_id}: {e}")
    return {"deleted": deleted_count}
