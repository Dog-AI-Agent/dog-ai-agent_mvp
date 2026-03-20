from supabase import create_client, Client
from backend.config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY

_client: Client | None = None
_storage_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def get_storage_supabase() -> Client:
    """Storage 업로드용 클라이언트 (Service Role Key 사용, RLS 우회)"""
    global _storage_client
    if _storage_client is None:
        # Service Key가 있으면 사용, 없으면 일반 키로 폴백
        key = SUPABASE_SERVICE_KEY if SUPABASE_SERVICE_KEY else SUPABASE_KEY
        _storage_client = create_client(SUPABASE_URL, key)
    return _storage_client
