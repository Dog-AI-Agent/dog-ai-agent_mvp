from fastapi import UploadFile, HTTPException
from PIL import Image
import io

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MIN_RESOLUTION = 224


async def validate_image(file: UploadFile) -> tuple[bytes, dict]:
    """Validate uploaded image and return (bytes, metadata)."""
    # Check MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Only JPEG and PNG are allowed."
        )

    contents = await file.read()

    # Check file size
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large: {len(contents)} bytes. Maximum is {MAX_FILE_SIZE} bytes (10MB)."
        )

    # Check resolution
    try:
        img = Image.open(io.BytesIO(contents))
        width, height = img.size
        img_format = img.format or "UNKNOWN"
    except Exception:
        raise HTTPException(status_code=400, detail="Cannot read image file.")

    if width < MIN_RESOLUTION or height < MIN_RESOLUTION:
        raise HTTPException(
            status_code=400,
            detail=f"Image too small: {width}x{height}. Minimum is {MIN_RESOLUTION}x{MIN_RESOLUTION}."
        )

    metadata = {
        "width": width,
        "height": height,
        "format": img_format,
        "size_bytes": len(contents),
    }

    return contents, metadata
