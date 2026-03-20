"""
Image Pipeline — Single preprocessing entry point for dog detection + classification.
Decodes raw bytes to PIL, resizes to 224x224 ONCE, computes sha256 hash.
"""
import hashlib
import io
from dataclasses import dataclass

import numpy as np
from PIL import Image

INPUT_SIZE = (224, 224)


@dataclass(frozen=True, slots=True)
class PreprocessedImage:
    """Shared image representation consumed by both detector and classifier."""
    original_bytes: bytes
    pil_image: Image.Image
    preprocessed_array: np.ndarray  # shape (1, 224, 224, 3), float32
    image_hash: str  # sha256 hex digest


def preprocess_image(raw_bytes: bytes) -> PreprocessedImage:
    image_hash = hashlib.sha256(raw_bytes).hexdigest()
    try:
        pil_image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    except Exception as exc:
        raise ValueError(f"Cannot decode image bytes: {exc}") from exc

    pil_resized = pil_image.resize(INPUT_SIZE, Image.LANCZOS)
    arr = np.array(pil_resized, dtype=np.float32)
    arr = np.expand_dims(arr, axis=0)

    return PreprocessedImage(
        original_bytes=raw_bytes,
        pil_image=pil_resized,
        preprocessed_array=arr,
        image_hash=image_hash,
    )
