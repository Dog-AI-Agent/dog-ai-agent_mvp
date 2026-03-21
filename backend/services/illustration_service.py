"""
Illustration Service — DALL-E 3로 강아지 카툰 일러스트 생성 + Supabase Storage 업로드
"""

import io
import logging
import httpx
from PIL import Image
from openai import OpenAI

from backend.config import OPENAI_API_KEY
from backend.database import get_supabase, get_storage_supabase

logger = logging.getLogger(__name__)

BUCKET_NAME = "illustrations"


_build_illustration_prompt = (
    lambda breed_name_en: (
        # 1. 스타일 먼저 명확히 정의 (치비 + 두꺼운 아웃라인 + 벡터)
        "Chibi-style cute cartoon dog illustration with thick black outlines, "
        "flat vector art, clean cel-shading, soft pastel colors. "

        # 2. 구도: 머리 왼쪽, 꼬리 오른쪽, 걷는 포즈 명시
        f"A {breed_name_en} puppy walking toward the left side, "
        "head on the left and tail on the right, full body side profile view. "
        "Front paw slightly raised mid-step, cheerful face with big shiny eyes and small open mouth. "

        # 3. 배경 및 기타 제약
        "Pure white background, no shadow, no text, no watermark, "
        "single character centered in frame, no other objects."
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

    # 2) 이미지 다운로드 + 좌우 반전 (DALL-E가 왼쪽을 보게 생성 → 반전하여 오른쪽 방향으로)
    async with httpx.AsyncClient(timeout=30.0) as http:
        img_response = await http.get(image_url)
        img_response.raise_for_status()

    img = Image.open(io.BytesIO(img_response.content))
    img = img.transpose(Image.FLIP_LEFT_RIGHT)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    image_bytes = buf.getvalue()

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
