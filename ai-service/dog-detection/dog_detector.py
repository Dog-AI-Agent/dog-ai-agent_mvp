"""
Dog Detector — MobileNetV2 imagenet, async non-blocking.
Pair2 리팩터링: run_in_executor + module-level model load
"""
from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import numpy as np
import tensorflow as tf
from keras.applications.mobilenet_v2 import preprocess_input

if TYPE_CHECKING:
    from image_pipeline import PreprocessedImage
    from prediction_cache import DetectionResult

DOG_CLASS_START = 151
DOG_CLASS_END = 268

# Module-level load — 한 번만 로드, 요청마다 import 안 함
_model = None


def load_model():
    global _model
    if _model is None:
        _model = tf.keras.applications.MobileNetV2(weights="imagenet")
    return _model


def _predict_sync(batch: np.ndarray) -> np.ndarray:
    return load_model().predict(batch, verbose=0)


async def predict_dog(img: "PreprocessedImage") -> "DetectionResult":
    """MobileNetV2 dog detection — run_in_executor로 비동기 실행."""
    from prediction_cache import DetectionResult

    loop = asyncio.get_running_loop()
    batch = preprocess_input(img.preprocessed_array.copy())
    preds = await loop.run_in_executor(None, _predict_sync, batch)

    top_idx = int(np.argmax(preds[0]))
    confidence = float(preds[0][top_idx])
    is_dog = DOG_CLASS_START <= top_idx <= DOG_CLASS_END

    return DetectionResult(is_dog=is_dog, confidence=confidence, top_class_index=top_idx)


async def warmup_detector() -> None:
    """Dummy inference로 TF 그래프 컴파일 (첫 요청 지연 제거)."""
    loop = asyncio.get_running_loop()
    dummy = preprocess_input(np.zeros((1, 224, 224, 3), dtype=np.float32))
    await loop.run_in_executor(None, _predict_sync, dummy)


# 기존 호환: is_dog_from_bytes (동기 버전)
def is_dog_from_bytes(image_bytes: bytes) -> bool:
    import io
    from PIL import Image
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((224, 224))
    x = preprocess_input(np.expand_dims(np.array(img, dtype=np.float32), axis=0))
    preds = _predict_sync(x)
    top_class = int(np.argmax(preds[0]))
    return DOG_CLASS_START <= top_class <= DOG_CLASS_END
