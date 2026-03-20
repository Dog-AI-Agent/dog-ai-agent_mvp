from fastapi import APIRouter, Depends, HTTPException

from backend.database import get_supabase
from backend.deps import get_current_user_id
from backend.models.schemas import (
    DogCreateRequest,
    DogResponse,
    DogUpdateRequest,
    UserResponse,
    UserUpdateRequest,
)

router = APIRouter(prefix="/users", tags=["users"])


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

    # 닉네임 중복 확인
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
        raise HTTPException(status_code=409, detail="이미 등록된 반려견이 있습니다. 수정 API를 사용해주세요.")

    new_dog = {
        "user_id": user_id,
        "name": body.name,
        "birthday": body.birthday,
        "breed_id": body.breed_id,
        "favorite_ingredients": body.favorite_ingredients or [],
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
