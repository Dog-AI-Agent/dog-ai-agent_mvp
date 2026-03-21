"""
Chat API — 품종 기반 RAG 챗봇
"""
import json
import logging
import re

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from backend.database import get_supabase
from backend.models.schemas import (
    ChatSessionCreate,
    ChatSessionResponse,
    ChatMessageRequest,
    ChatMessageResponse,
    ChatHistoryResponse,
)
from backend.services.chat_service import get_chat_response, stream_chat_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

_BREED_ID_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


def _validate_breed_id(breed_id: str) -> None:
    if not breed_id or len(breed_id) > 64 or not _BREED_ID_RE.match(breed_id):
        raise HTTPException(status_code=400, detail="유효하지 않은 breed_id입니다.")


# ── 세션 생성 ──

@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session(body: ChatSessionCreate):
    _validate_breed_id(body.breed_id)

    sb = get_supabase()
    result = await run_in_threadpool(
        lambda: sb.table("chat_sessions")
        .insert({"breed_id": body.breed_id})
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="세션 생성에 실패했습니다.")

    session = result.data[0]
    return ChatSessionResponse(
        session_id=session["id"],
        breed_id=session["breed_id"],
        created_at=session["created_at"],
    )


# ── 메시지 전송 (RAG 응답) ──

@router.post("/sessions/{session_id}/messages", response_model=ChatMessageResponse)
async def send_message(session_id: str, body: ChatMessageRequest):
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="메시지가 비어있습니다.")

    sb = get_supabase()

    # 세션 존재 확인 + breed_id 조회
    # FIX: maybe_single() → limit(1) — 결과 없을 때 204 APIError 방지
    session = await run_in_threadpool(
        lambda: sb.table("chat_sessions")
        .select("id, breed_id")
        .eq("id", session_id)
        .limit(1)
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    breed_id = session.data[0]["breed_id"]  # FIX: 리스트 [0] 접근

    # 기존 대화 기록 조회
    history_result = await run_in_threadpool(
        lambda: sb.table("chat_messages")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    history = history_result.data or []

    # 사용자 메시지 저장
    await run_in_threadpool(
        lambda: sb.table("chat_messages")
        .insert({"session_id": session_id, "role": "user", "content": body.content.strip()})
        .execute()
    )

    # LLM 응답 생성
    assistant_content = await get_chat_response(breed_id, body.content.strip(), history)

    # 어시스턴트 메시지 저장
    saved = await run_in_threadpool(
        lambda: sb.table("chat_messages")
        .insert({"session_id": session_id, "role": "assistant", "content": assistant_content})
        .execute()
    )

    msg = saved.data[0] if saved.data else {}
    return ChatMessageResponse(
        message_id=msg.get("id", ""),
        role="assistant",
        content=assistant_content,
        created_at=msg.get("created_at", ""),
    )


# ── 메시지 스트리밍 전송 (NDJSON) ──

@router.post("/sessions/{session_id}/messages/stream")
async def send_message_stream(session_id: str, body: ChatMessageRequest):
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="메시지가 비어있습니다.")

    sb = get_supabase()

    session = await run_in_threadpool(
        lambda: sb.table("chat_sessions")
        .select("id, breed_id")
        .eq("id", session_id)
        .limit(1)
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    breed_id = session.data[0]["breed_id"]

    history_result = await run_in_threadpool(
        lambda: sb.table("chat_messages")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    history = history_result.data or []

    await run_in_threadpool(
        lambda: sb.table("chat_messages")
        .insert({"session_id": session_id, "role": "user", "content": body.content.strip()})
        .execute()
    )

    async def _generate():
        full_content = ""
        try:
            async for token in stream_chat_response(breed_id, body.content.strip(), history):
                full_content += token
                yield json.dumps({"token": token}, ensure_ascii=False) + "\n"
        except Exception:
            logger.exception("Streaming chat failed")

        if not full_content:
            full_content = "죄송합니다. 일시적으로 응답을 생성할 수 없습니다."
            yield json.dumps({"token": full_content}, ensure_ascii=False) + "\n"

        saved = await run_in_threadpool(
            lambda: sb.table("chat_messages")
            .insert({"session_id": session_id, "role": "assistant", "content": full_content})
            .execute()
        )
        msg = saved.data[0] if saved.data else {}
        yield json.dumps({
            "done": True,
            "message_id": msg.get("id", ""),
            "content": full_content,
        }, ensure_ascii=False) + "\n"

    return StreamingResponse(_generate(), media_type="application/x-ndjson")


# ── 대화 기록 조회 ──

@router.get("/sessions/{session_id}/messages", response_model=ChatHistoryResponse)
async def get_messages(session_id: str):
    sb = get_supabase()

    # 세션 존재 확인
    # FIX: maybe_single() → limit(1) — 결과 없을 때 204 APIError 방지
    session = await run_in_threadpool(
        lambda: sb.table("chat_sessions")
        .select("id, breed_id")
        .eq("id", session_id)
        .limit(1)
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    messages = await run_in_threadpool(
        lambda: sb.table("chat_messages")
        .select("id, role, content, created_at")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )

    return ChatHistoryResponse(
        session_id=session_id,
        breed_id=session.data[0]["breed_id"],  # FIX: 리스트 [0] 접근
        messages=[
            ChatMessageResponse(
                message_id=m["id"],
                role=m["role"],
                content=m["content"],
                created_at=m["created_at"],
            )
            for m in (messages.data or [])
        ],
    )
