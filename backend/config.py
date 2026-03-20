import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL", "")

# 새 포맷 키 (sb_publishable_*, sb_secret_*) — DB 쿼리용
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", os.getenv("SUPABASE_KEY", ""))
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""))

# Legacy JWT 키 — Supabase Storage REST API 업로드용 (JWT 형식 필요)
# Supabase Dashboard → Settings → API → "Legacy anon, service_role API keys" 탭
SUPABASE_ANON_KEY = os.getenv("SUPABASE_LEGACY_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_JWT = os.getenv("SUPABASE_LEGACY_SERVICE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
AI_SERVER_URL = os.getenv("AI_SERVICE_URL", os.getenv("AI_SERVER_URL", "http://localhost:8001"))

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-secret-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24 * 7  # 7일

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8081")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/v1/auth/google/callback")

NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID", "")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET", "")
NAVER_REDIRECT_URI = os.getenv("NAVER_REDIRECT_URI", "http://localhost:8000/api/v1/auth/naver/callback")

KAKAO_CLIENT_ID = os.getenv("KAKAO_CLIENT_ID", "")
KAKAO_CLIENT_SECRET = os.getenv("KAKAO_CLIENT_SECRET", "")
KAKAO_REDIRECT_URI = os.getenv("KAKAO_REDIRECT_URI", "http://localhost:8000/api/v1/auth/kakao/callback")
