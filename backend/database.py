import httpx
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from backend.config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY

_client: Client | None = None
_storage_client: Client | None = None


def _make_client(url: str, key: str) -> Client:
    """HTTP/2 비활성화 + 재연결 옵션으로 안정적인 Supabase 클라이언트 생성"""
    try:
        options = ClientOptions(postgrest_client_timeout=30, storage_client_timeout=30)
        client = create_client(url, key, options=options)
    except (TypeError, AttributeError):
        # 일부 버전에서 storage_client_timeout 미지원
        try:
            options = ClientOptions(postgrest_client_timeout=30)
            client = create_client(url, key, options=options)
        except (TypeError, AttributeError):
            client = create_client(url, key)
    # HTTP/2 → HTTP/1.1 강제 (RemoteProtocolError: Server disconnected 방지)
    client.postgrest.session = httpx.Client(http2=False, timeout=30.0)
    return client


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = _make_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def get_storage_supabase() -> Client:
    """Storage 업로드용 클라이언트 (Service Role Key 사용, RLS 우회)"""
    global _storage_client
    if _storage_client is None:
        key = SUPABASE_SERVICE_KEY if SUPABASE_SERVICE_KEY else SUPABASE_KEY
        _storage_client = _make_client(SUPABASE_URL, key)
    return _storage_client
