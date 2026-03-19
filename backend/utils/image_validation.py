from fastapi import UploadFile, HTTPException
from PIL import Image
import io

# 직접 허용하는 MIME 타입
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/bmp",
    "image/gif",
    "image/tiff",
    "image/heic",
    "image/heif",
    "image/x-png",
    "image/x-bmp",
    "application/octet-stream",  # 일부 브라우저가 HEIC 를 이렇게 전송
}

# JPEG 으로 변환이 필요한 포맷 (AI 모델 호환)
CONVERT_TO_JPEG = {"webp", "bmp", "gif", "tiff", "heic", "heif"}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MIN_RESOLUTION = 224


async def validate_image(file: UploadFile) -> tuple[bytes, dict]:
    """Validate uploaded image and return (bytes, metadata).
    비표준 포맷(WebP, BMP, GIF 등)은 자동으로 JPEG 으로 변환합니다.
    """
    content_type = (file.content_type or "").lower()

    # MIME 타입 체크 — octet-stream 은 일단 통과시키고 PIL 로 재확인
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type: {content_type}. "
                "JPEG, PNG, WebP, BMP, GIF, TIFF, HEIC 를 지원합니다."
            ),
        )

    contents = await file.read()

    # 파일 크기 체크
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large: {len(contents)} bytes. Maximum is {MAX_FILE_SIZE} bytes (10MB).",
        )

    # PIL 로 이미지 열기 (포맷 자동 감지)
    try:
        img = Image.open(io.BytesIO(contents))
        img.load()  # 실제 픽셀 데이터까지 로드해서 손상 여부 확인
        width, height = img.size
        img_format = (img.format or "UNKNOWN").lower()
    except Exception:
        raise HTTPException(status_code=400, detail="Cannot read image file.")

    # 해상도 체크
    if width < MIN_RESOLUTION or height < MIN_RESOLUTION:
        raise HTTPException(
            status_code=400,
            detail=f"Image too small: {width}x{height}. Minimum is {MIN_RESOLUTION}x{MIN_RESOLUTION}.",
        )

    # 비표준 포맷 → JPEG 변환 (AI 모델 호환성)
    if img_format in CONVERT_TO_JPEG or content_type in (
        "image/webp", "image/bmp", "image/gif",
        "image/tiff", "image/heic", "image/heif",
    ):
        buf = io.BytesIO()
        rgb_img = img.convert("RGB")  # RGBA/P 모드 대응
        rgb_img.save(buf, format="JPEG", quality=92)
        contents = buf.getvalue()
        img_format = "jpeg"

    metadata = {
        "width": width,
        "height": height,
        "format": img_format.upper(),
        "size_bytes": len(contents),
    }

    return contents, metadata
