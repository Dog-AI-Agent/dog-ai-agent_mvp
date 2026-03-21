"""
Illustration Service — DALL-E 3로 강아지 카툰 일러스트 생성 + Supabase Storage 업로드
"""

import logging
import httpx
from openai import OpenAI

from backend.config import OPENAI_API_KEY
from backend.database import get_supabase, get_storage_supabase

logger = logging.getLogger(__name__)

BUCKET_NAME = "illustrations"


_build_illustration_prompt = (
    lambda breed_name_en: (
        f"A single adorable chibi-style cartoon illustration of a {breed_name_en} dog. "
        "The dog is walking to the left, shown from the side profile view with a cheerful expression. "
        "Soft pastel color palette, rounded shapes. "
        "Clean vector art style, no text, no watermark, plain solid white background with nothing else."
    )
)


generate_illustration = lambda breed_name_en, user_id, analysis_id: _generate(
    breed_name_en, user_id, analysis_id
)


async def _generate(breed_name_en: str, user_id: str, analysis_id: str) -> str:
    """
    DALL-E 3로 일러스트 생성 → Supabase Storage 업로드 → public URL 반환.
    """
    prompt = _build_illustration_prompt(breed_name_en)
    logger.info(f"[ILLUSTRATION] 생성 시작: breed={breed_name_en}, analysis={analysis_id}")

    # 1) DALL-E 3 호출
    client = OpenAI(api_key=OPENAI_API_KEY)
    response = client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size="1024x1024",
        quality="standard",
        n=1,
    )
    image_url = response.data[0].url
    logger.info(f"[ILLUSTRATION] DALL-E 생성 완료: {image_url[:80]}...")

    # 2) 이미지 다운로드
    async with httpx.AsyncClient(timeout=30.0) as http:
        img_response = await http.get(image_url)
        img_response.raise_for_status()
        image_bytes = img_response.content

    # 3) Supabase Storage 업로드
    storage_path = f"{user_id}/{analysis_id}.png"
    storage = get_storage_supabase()

    try:
        storage.storage.from_(BUCKET_NAME).remove([storage_path])
    except Exception:
        pass  # 기존 파일 없으면 무시

    storage.storage.from_(BUCKET_NAME).upload(
        path=storage_path,
        file=image_bytes,
        file_options={"content-type": "image/png"},
    )

    # 4) public URL 생성
    public_url = storage.storage.from_(BUCKET_NAME).get_public_url(storage_path)
    logger.info(f"[ILLUSTRATION] 업로드 완료: {public_url}")

    # 5) DB 업데이트
    db = get_supabase()
    db.table("analysis_history").update(
        {"illustration_url": public_url}
    ).eq("id", analysis_id).execute()

    return public_url
