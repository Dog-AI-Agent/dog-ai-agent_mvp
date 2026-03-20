import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from jose import jwt
from passlib.context import CryptContext

from backend.config import (
    FRONTEND_URL,
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI,
    JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET_KEY,
    KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET, KAKAO_REDIRECT_URI,
    NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_REDIRECT_URI,
)
from backend.database import get_supabase
from backend.models.schemas import LoginRequest, SignupRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire}, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


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


# ── 일반 회원가입 / 로그인 ─────────────────────────────────────────────────────

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest):
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")

    db = get_supabase()

    existing = db.table("users").select("id").eq("email", body.email).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="이미 사용 중인 이메일입니다.")

    existing_nick = db.table("users").select("id").eq("nickname", body.nickname).execute()
    if existing_nick.data:
        raise HTTPException(status_code=409, detail="이미 사용 중인 닉네임입니다.")

    new_user = {
        "name": body.name,
        "email": body.email,
        "nickname": body.nickname,
        "password_hash": _hash_password(body.password),
        "birth_date": body.birth_date,
        "address": body.address,
    }

    result = db.table("users").insert(new_user).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="회원가입 처리 중 오류가 발생했습니다.")

    user_row = result.data[0]
    token = _create_access_token(str(user_row["id"]))
    return TokenResponse(access_token=token, user=_to_user_response(user_row))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    db = get_supabase()

    result = db.table("users").select("*").eq("email", body.email).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")

    user_row = result.data[0]
    if not user_row.get("password_hash"):
        raise HTTPException(status_code=401, detail="소셜 로그인으로 가입된 계정입니다.")
    if not _verify_password(body.password, user_row["password_hash"]):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")

    token = _create_access_token(str(user_row["id"]))
    return TokenResponse(access_token=token, user=_to_user_response(user_row))


# ── OAuth 공통 헬퍼 ───────────────────────────────────────────────────────────

def _oauth_success_redirect(user_row: dict) -> RedirectResponse:
    """JWT 발급 후 프론트엔드로 리다이렉트"""
    token = _create_access_token(str(user_row["id"]))
    import json
    user_json = json.dumps({
        "user_id": str(user_row["id"]),
        "name": user_row["name"],
        "email": user_row["email"],
        "nickname": user_row["nickname"],
        "birth_date": str(user_row["birth_date"]) if user_row.get("birth_date") else None,
        "address": user_row.get("address"),
        "created_at": str(user_row["created_at"]),
    })
    from urllib.parse import quote
    redirect_url = f"{FRONTEND_URL}?auth_token={token}&auth_user={quote(user_json)}"
    return RedirectResponse(url=redirect_url)


def _upsert_oauth_user(db, provider: str, oauth_id: str, email: str, name: str) -> dict:
    """소셜 로그인 유저 조회 또는 생성"""
    # 1) 기존 oauth 유저 조회
    existing = db.table("users").select("*").eq("oauth_provider", provider).eq("oauth_id", oauth_id).execute()
    if existing.data:
        return existing.data[0]

    # 2) 같은 이메일로 가입된 일반 계정이 있으면 oauth 정보 연결
    by_email = db.table("users").select("*").eq("email", email).execute()
    if by_email.data:
        user_row = by_email.data[0]
        db.table("users").update({"oauth_provider": provider, "oauth_id": oauth_id}).eq("id", user_row["id"]).execute()
        user_row["oauth_provider"] = provider
        user_row["oauth_id"] = oauth_id
        return user_row

    # 3) 신규 유저 생성 (닉네임 중복 방지)
    base_nick = name[:10] if name else "user"
    nickname = base_nick
    suffix = 1
    while True:
        dup = db.table("users").select("id").eq("nickname", nickname).execute()
        if not dup.data:
            break
        nickname = f"{base_nick}{suffix}"
        suffix += 1

    result = db.table("users").insert({
        "name": name,
        "email": email,
        "nickname": nickname,
        "oauth_provider": provider,
        "oauth_id": oauth_id,
    }).execute()
    return result.data[0]


# ── Google OAuth ──────────────────────────────────────────────────────────────

@router.get("/google")
async def google_login():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth가 설정되지 않았습니다.")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return RedirectResponse(url=url)


@router.get("/google/callback")
async def google_callback(code: str = Query(...)):
    async with httpx.AsyncClient() as client:
        # 코드 → 액세스 토큰
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return RedirectResponse(url=f"{FRONTEND_URL}?oauth_error=google_token_failed")

        # 유저 정보 조회
        user_res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        info = user_res.json()

    db = get_supabase()
    user_row = _upsert_oauth_user(
        db,
        provider="google",
        oauth_id=info["id"],
        email=info.get("email", ""),
        name=info.get("name", info.get("email", "Google User")),
    )
    return _oauth_success_redirect(user_row)


# ── Naver OAuth ───────────────────────────────────────────────────────────────

@router.get("/naver")
async def naver_login():
    if not NAVER_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Naver OAuth가 설정되지 않았습니다.")
    state = secrets.token_urlsafe(16)
    params = {
        "response_type": "code",
        "client_id": NAVER_CLIENT_ID,
        "redirect_uri": NAVER_REDIRECT_URI,
        "state": state,
    }
    url = "https://nid.naver.com/oauth2.0/authorize?" + urlencode(params)
    return RedirectResponse(url=url)


@router.get("/naver/callback")
async def naver_callback(code: str = Query(...), state: str = Query(default="")):
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://nid.naver.com/oauth2.0/token",
            params={
                "grant_type": "authorization_code",
                "client_id": NAVER_CLIENT_ID,
                "client_secret": NAVER_CLIENT_SECRET,
                "code": code,
                "state": state,
            },
        )
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return RedirectResponse(url=f"{FRONTEND_URL}?oauth_error=naver_token_failed")

        user_res = await client.get(
            "https://openapi.naver.com/v1/nid/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        info = user_res.json().get("response", {})

    db = get_supabase()
    user_row = _upsert_oauth_user(
        db,
        provider="naver",
        oauth_id=info.get("id", ""),
        email=info.get("email", ""),
        name=info.get("name", info.get("nickname", "Naver User")),
    )
    return _oauth_success_redirect(user_row)


# ── Kakao OAuth ───────────────────────────────────────────────────────────────

@router.get("/kakao")
async def kakao_login():
    if not KAKAO_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Kakao OAuth가 설정되지 않았습니다.")
    params = {
        "client_id": KAKAO_CLIENT_ID,
        "redirect_uri": KAKAO_REDIRECT_URI,
        "response_type": "code",
    }
    url = "https://kauth.kakao.com/oauth/authorize?" + urlencode(params)
    return RedirectResponse(url=url)


@router.get("/kakao/callback")
async def kakao_callback(code: str = Query(...)):
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://kauth.kakao.com/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": KAKAO_CLIENT_ID,
                "client_secret": KAKAO_CLIENT_SECRET,
                "redirect_uri": KAKAO_REDIRECT_URI,
                "code": code,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return RedirectResponse(url=f"{FRONTEND_URL}?oauth_error=kakao_token_failed")

        user_res = await client.get(
            "https://kapi.kakao.com/v2/user/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        info = user_res.json()

    kakao_account = info.get("kakao_account", {})
    profile = kakao_account.get("profile", {})

    db = get_supabase()
    user_row = _upsert_oauth_user(
        db,
        provider="kakao",
        oauth_id=str(info.get("id", "")),
        email=kakao_account.get("email", ""),
        name=profile.get("nickname", "Kakao User"),
    )
    return _oauth_success_redirect(user_row)
